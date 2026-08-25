import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InquiryIntent,
  ListingStatus,
  NotificationType,
  VehicleBookingStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { buildCommerceConfirmationEmail } from '../../common/mail/commerce-confirmation-email.util';
import { formatMoneyRwf, rwfToUsdAmount } from '../../common/money/money-format.util';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { generateReferenceNumber } from '../../common/utils/reference-number.util';
import { NotificationsService } from '../notifications/notifications.service';
import { ExchangeRateService } from '../platform-settings/exchange-rate.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { inquiryListingInclude } from '../inquiries/inquiry.mapper';
import { QuotePdfService } from '../inquiries/quote-pdf.service';
import { ACTIVE_INVOICE_STATUSES } from '../invoices/invoice.constants';
import {
  ACTIVE_BOOKING_STATUSES,
  ADMIN_EDITABLE_BOOKING_FEE_STATUSES,
  BOOKING_PAYABLE_STATUSES,
  BOOKING_VALIDITY_DAYS,
  BUYER_CANCELLABLE_BOOKING_STATUSES,
  INACTIVE_BOOKING_STATUSES,
} from './booking.constants';
import { FilterBookingsDto } from './dto/filter-bookings.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { RequestVehicleBookingDto } from './dto/request-vehicle-booking.dto';
import type { SubmitBookingPaymentDto } from './dto/submit-booking-payment.dto';
import type { UpdateBookingFeeDto } from './dto/update-booking-fee.dto';

const bookingInclude = {
  listing: {
    select: {
      id: true,
      slug: true,
      listingTitle: true,
      brand: true,
      model: true,
      sellerType: true,
      status: true,
      isBooked: true,
    },
  },
  proofs: true,
} as const;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly quotePdfService: QuotePdfService,
    private readonly configService: ConfigService,
  ) {}

  getBookingFeeUsd(): Promise<number> {
    return this.platformSettingsService.getBookingFeeUsd();
  }

  getBookingFeeRwf(): Promise<number> {
    return this.platformSettingsService.getBookingFeeRwf();
  }

  async updateBookingFee(
    adminId: string,
    bookingId: string,
    dto: UpdateBookingFeeDto,
    auditContext: RequestAuditContext = {},
  ) {
    const booking = await this.prisma.vehicleBooking.findUnique({
      where: { id: bookingId },
      include: {
        listing: { select: { listingTitle: true } },
        proofs: { select: { id: true }, take: 1 },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (
      !ADMIN_EDITABLE_BOOKING_FEE_STATUSES.includes(
        booking.status as (typeof ADMIN_EDITABLE_BOOKING_FEE_STATUSES)[number],
      )
    ) {
      throw new BadRequestException(
        'Booking fee can only be changed while awaiting payment',
      );
    }

    if (booking.proofs.length > 0) {
      throw new BadRequestException(
        'Booking fee cannot be changed after payment proof is submitted',
      );
    }

    const rate = (
      await this.exchangeRateService.getSnapshot({ refreshIfStale: false })
    ).usdToRwfEffective;
    const nextFeeRwf =
      dto.bookingFeeRwf ??
      (dto.bookingFeeUsd != null
        ? Math.round(dto.bookingFeeUsd * rate)
        : null);
    if (nextFeeRwf == null || !(nextFeeRwf > 0)) {
      throw new BadRequestException('Booking fee in Rwf is required');
    }
    const previousFeeRwf =
      booking.bookingFeeRwf ?? Math.round(booking.bookingFeeUsd * rate);
    const updated = await this.prisma.vehicleBooking.update({
      where: { id: booking.id },
      data: {
        bookingFeeRwf: nextFeeRwf,
        bookingFeeUsd: rwfToUsdAmount(nextFeeRwf, rate),
        currency: 'RWF',
      },
      include: bookingInclude,
    });

    await this.notificationsService.send({
      userId: booking.userId,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Booking fee updated',
      body: `The booking fee for ${booking.listing.listingTitle} was updated from ${formatMoneyRwf(previousFeeRwf)} to ${formatMoneyRwf(nextFeeRwf)}.`,
      metadata: {
        bookingId: booking.id,
        previousFeeRwf,
        bookingFeeRwf: nextFeeRwf,
      },
    });

    await this.auditService.record({
      userId: adminId,
      action: 'bookings:fee-updated',
      entity: 'VehicleBooking',
      entityId: booking.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        previousFeeRwf,
        bookingFeeRwf: nextFeeRwf,
      },
    });

    return updated;
  }

  async requestBooking(
    userId: string,
    dto: RequestVehicleBookingDto,
    auditContext: RequestAuditContext = {},
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { buyerProfile: true },
    });
    if (!user?.buyerProfile) {
      throw new BadRequestException(
        'Complete your buyer profile before booking a vehicle',
      );
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      include: inquiryListingInclude,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status !== ListingStatus.PUBLISHED) {
      throw new BadRequestException('This vehicle is not available to book');
    }

    const existingForUser = await this.prisma.vehicleBooking.findFirst({
      where: {
        userId,
        listingId: listing.id,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
    });

    if (existingForUser) {
      throw new BadRequestException(
        'You already have an active booking for this vehicle',
      );
    }

    const userActiveInvoice = await this.prisma.invoice.findFirst({
      where: {
        listingId: listing.id,
        userId,
        status: { in: [...ACTIVE_INVOICE_STATUSES] },
      },
    });

    if (userActiveInvoice) {
      throw new BadRequestException(
        'You already have an active invoice for this vehicle. Complete or cancel it before booking.',
      );
    }

    const [bookingNumber, paymentReference] = await Promise.all([
      generateReferenceNumber(this.prisma, 'UZM-BKG'),
      generateReferenceNumber(this.prisma, 'UZM-BKG-PAY'),
    ]);

    const bookingFeeRwf = await this.getBookingFeeRwf();
    const exchangeRate = await this.exchangeRateService.getSnapshot({
      refreshIfStale: false,
    });
    const validUntil = this.addDays(new Date(), BOOKING_VALIDITY_DAYS);

    const booking = await this.prisma.vehicleBooking.create({
      data: {
        bookingNumber,
        paymentReference,
        listingId: listing.id,
        userId,
        bookingFeeUsd: rwfToUsdAmount(
          bookingFeeRwf,
          exchangeRate.usdToRwfEffective,
        ),
        bookingFeeRwf,
        currency: 'RWF',
        status: VehicleBookingStatus.AWAITING_PAYMENT,
        validUntil,
        notes: dto.notes,
      },
      include: bookingInclude,
    });

    const buyerName = `${user.firstName} ${user.lastName}`.trim();
    const company =
      await this.platformSettingsService.getCompanyPaymentDetails();
    const pdfBuffer = await this.quotePdfService.generateBuffer(
      paymentReference,
      InquiryIntent.BOOK,
      listing,
      {
        name: buyerName,
        email: user.email,
        phone: user.phone ?? '',
        country: user.buyerProfile.country,
        buyerType: user.buyerProfile.buyerType,
      },
    );
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const appName =
      this.configService.get<string>('APP_NAME') ?? 'UZA Mobility';
    const emailContent = buildCommerceConfirmationEmail({
      appName,
      frontendUrl,
      recipientName: buyerName,
      listing,
      referenceNumber: paymentReference,
      intent: InquiryIntent.BOOK,
      company,
      bookingFeeRwf,
      usdToRwfEffective: exchangeRate.usdToRwfEffective,
      accountActionUrl: `${frontendUrl}/my/bookings?highlight=${booking.id}`,
      accountActionLabel: 'View my booking',
      footerReason: `You are receiving this email because you created a vehicle booking on ${appName}.`,
    });

    await this.notificationsService.send({
      userId,
      type: NotificationType.INVOICE_ISSUED,
      title: 'Vehicle booking created',
      body: `Pay the booking fee of ${formatMoneyRwf(bookingFeeRwf)} using reference ${paymentReference}. Your booking quote PDF is attached.`,
      metadata: { bookingId: booking.id, listingId: listing.id },
      emailSubject: emailContent.subject,
      emailHtml: emailContent.html,
      emailAttachments: [
        { filename: `${bookingNumber}.pdf`, content: pdfBuffer },
      ],
    });

    await this.auditService.record({
      userId,
      action: 'bookings:requested',
      entity: 'VehicleBooking',
      entityId: booking.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { email: auditContext.actorEmail, listingId: listing.id },
    });

    return booking;
  }

  async submitPayment(
    userId: string,
    bookingId: string,
    dto: SubmitBookingPaymentDto,
    proofUrls: string[] = [],
    auditContext: RequestAuditContext = {},
  ) {
    const booking = await this.prisma.vehicleBooking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You do not own this booking');
    }

    const canSubmitPayment =
      BOOKING_PAYABLE_STATUSES.includes(
        booking.status as (typeof BOOKING_PAYABLE_STATUSES)[number],
      ) ||
      (booking.status === VehicleBookingStatus.REJECTED &&
        Boolean(booking.rejectionReason));

    if (!canSubmitPayment) {
      throw new BadRequestException(
        `Cannot submit payment for booking in status ${booking.status}`,
      );
    }

    const currency = 'RWF';
    const exchangeRate = await this.exchangeRateService.getSnapshot({
      refreshIfStale: false,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      if (proofUrls.length) {
        await tx.bookingPaymentProof.createMany({
          data: proofUrls.map((url) => ({
            bookingId: booking.id,
            fileUrl: url,
            fileType: this.inferFileType(url),
            fileName: url.split('/').pop() ?? 'proof',
          })),
        });
      }

      return tx.vehicleBooking.update({
        where: { id: booking.id },
        data: {
          amountPaid: dto.amountPaid,
          currency,
          bankName: dto.bankName,
          transferReference: dto.transferReference ?? booking.paymentReference,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          senderName: dto.senderName,
          notes: dto.notes ?? booking.notes,
          exchangeRateUsed: exchangeRate.usdToRwfEffective,
          status: VehicleBookingStatus.UNDER_VERIFICATION,
          rejectionReason: null,
        },
        include: bookingInclude,
      });
    });

    await this.notificationsService.sendToRoleNames(
      ['FINANCE_ADMIN', 'SUPER_ADMIN'],
      {
        type: NotificationType.SYSTEM_ALERT,
        title: 'Booking payment submitted',
        body: `Booking ${booking.bookingNumber} payment proof submitted.`,
        metadata: { bookingId: booking.id, listingId: booking.listingId },
      },
    );

    await this.auditService.record({
      userId,
      action: 'bookings:payment-submitted',
      entity: 'VehicleBooking',
      entityId: booking.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });

    return updated;
  }

  async cancelBookingByBuyer(
    userId: string,
    bookingId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const booking = await this.prisma.vehicleBooking.findUnique({
      where: { id: bookingId },
      include: {
        listing: { select: { listingTitle: true, brand: true, model: true } },
        user: { select: { firstName: true, lastName: true } },
        proofs: { select: { id: true }, take: 1 },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You do not own this booking');
    }

    if (booking.status === VehicleBookingStatus.CANCELLED) {
      return this.prisma.vehicleBooking.findUniqueOrThrow({
        where: { id: booking.id },
        include: bookingInclude,
      });
    }

    if (
      !BUYER_CANCELLABLE_BOOKING_STATUSES.includes(
        booking.status as (typeof BUYER_CANCELLABLE_BOOKING_STATUSES)[number],
      )
    ) {
      throw new BadRequestException(
        'This booking can only be cancelled before payment proof is submitted',
      );
    }

    if (booking.proofs.length > 0) {
      throw new BadRequestException(
        'Cannot cancel after payment proof has been submitted',
      );
    }

    const updated = await this.prisma.vehicleBooking.update({
      where: { id: booking.id },
      data: { status: VehicleBookingStatus.CANCELLED },
      include: bookingInclude,
    });

    const buyerName =
      `${booking.user.firstName} ${booking.user.lastName}`.trim();

    await this.notificationsService.send({
      userId,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Booking cancelled',
      body: `Booking ${booking.bookingNumber} was cancelled. You can book another vehicle when ready.`,
      metadata: { bookingId: booking.id, listingId: booking.listingId },
    });

    await this.notificationsService.sendToRoleNames(
      ['FINANCE_ADMIN', 'SUPER_ADMIN'],
      {
        type: NotificationType.SYSTEM_ALERT,
        title: 'Buyer cancelled vehicle booking',
        body: `${buyerName} cancelled booking ${booking.bookingNumber} for ${booking.listing.listingTitle}.`,
        metadata: {
          bookingId: booking.id,
          userId,
          listingId: booking.listingId,
        },
      },
    );

    await this.auditService.record({
      userId,
      action: 'bookings:buyer-cancelled',
      entity: 'VehicleBooking',
      entityId: booking.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        bookingNumber: booking.bookingNumber,
      },
    });

    return updated;
  }

  async findMine(userId: string, filters: FilterBookingsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const inactiveStatuses: VehicleBookingStatus[] = [
      VehicleBookingStatus.CANCELLED,
      VehicleBookingStatus.EXPIRED,
    ];

    const where = {
      userId,
      ...(filters.listingId ? { listingId: filters.listingId } : {}),
      ...(filters.status
        ? { status: filters.status }
        : {
            OR: [
              {
                status: {
                  notIn: [...inactiveStatuses, VehicleBookingStatus.REJECTED],
                },
              },
              {
                status: VehicleBookingStatus.REJECTED,
                rejectionReason: { not: null },
              },
            ],
          }),
    };

    const [items, total] = await Promise.all([
      this.prisma.vehicleBooking.findMany({
        where,
        include: bookingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.vehicleBooking.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findByIdForUser(userId: string, id: string) {
    const booking = await this.prisma.vehicleBooking.findUnique({
      where: { id },
      include: bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new ForbiddenException('You do not own this booking');
    }

    return booking;
  }

  async adminFindAll(filters: FilterBookingsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.listingId ? { listingId: filters.listingId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.vehicleBooking.findMany({
        where,
        include: {
          ...bookingInclude,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.vehicleBooking.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async confirmBooking(
    adminId: string,
    bookingId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const booking = await this.prisma.vehicleBooking.findUnique({
      where: { id: bookingId },
      include: { listing: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (
      booking.status !== VehicleBookingStatus.UNDER_VERIFICATION &&
      booking.status !== VehicleBookingStatus.PAYMENT_SUBMITTED
    ) {
      throw new BadRequestException(
        `Cannot confirm booking in status ${booking.status}`,
      );
    }

    const { updated } = await this.prisma.$transaction(async (tx) => {
      const confirmed = await tx.vehicleBooking.update({
        where: { id: booking.id },
        data: {
          status: VehicleBookingStatus.CONFIRMED,
          confirmedAt: new Date(),
          verifiedBy: adminId,
          verifiedAt: new Date(),
        },
        include: bookingInclude,
      });

      return { updated: confirmed };
    });

    await this.notificationsService.send({
      userId: booking.userId,
      type: NotificationType.PAYMENT_CONFIRMED,
      title: 'Vehicle booking confirmed',
      body: `Your booking for ${updated.listing.listingTitle} is confirmed.`,
      metadata: { bookingId: booking.id, listingId: booking.listingId },
    });

    await this.auditService.record({
      userId: adminId,
      action: 'bookings:confirmed',
      entity: 'VehicleBooking',
      entityId: booking.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });

    return updated;
  }

  async rejectBooking(
    adminId: string,
    bookingId: string,
    dto: RejectBookingDto,
    auditContext: RequestAuditContext = {},
  ) {
    const booking = await this.prisma.vehicleBooking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (
      booking.status !== VehicleBookingStatus.UNDER_VERIFICATION &&
      booking.status !== VehicleBookingStatus.PAYMENT_SUBMITTED
    ) {
      throw new BadRequestException(
        `Cannot reject booking in status ${booking.status}`,
      );
    }

    const updated = await this.prisma.vehicleBooking.update({
      where: { id: booking.id },
      data: {
        status: VehicleBookingStatus.AWAITING_PAYMENT,
        rejectionReason: dto.reason,
        verifiedBy: adminId,
        verifiedAt: new Date(),
      },
      include: bookingInclude,
    });

    const reasonText =
      dto.reason ?? 'Your booking payment could not be verified.';
    await this.notificationsService.send({
      userId: booking.userId,
      type: NotificationType.PAYMENT_REJECTED,
      title: 'Booking payment not verified',
      body: `${reasonText} Please resubmit payment from My bookings.`,
      metadata: { bookingId: booking.id, reason: dto.reason },
    });

    await this.auditService.record({
      userId: adminId,
      action: 'bookings:rejected',
      entity: 'VehicleBooking',
      entityId: booking.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
    });

    return updated;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private inferFileType(url: string): string {
    const lower = url.toLowerCase();
    if (lower.endsWith('.pdf')) return 'PDF';
    if (lower.endsWith('.png')) return 'PNG';
    if (lower.endsWith('.webp')) return 'WEBP';
    return 'JPG';
  }
}
