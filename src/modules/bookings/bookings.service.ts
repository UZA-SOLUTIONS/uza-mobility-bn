import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingStatus,
  NotificationType,
  VehicleBookingStatus,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { generateReferenceNumber } from '../../common/utils/reference-number.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ACTIVE_INVOICE_STATUSES } from '../invoices/invoice.constants';
import {
  supersedeActiveBookingsForListing,
  supersedeActiveInvoicesForListing,
} from '../commerce/supersede.util';
import { SUPERSEDED_BY_OTHER_BUYER_MESSAGE } from '../commerce/supersede.constants';
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
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  getBookingFeeUsd(): Promise<number> {
    return this.platformSettingsService.getBookingFeeUsd();
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

    const previousFee = booking.bookingFeeUsd;
    const updated = await this.prisma.vehicleBooking.update({
      where: { id: booking.id },
      data: { bookingFeeUsd: dto.bookingFeeUsd },
      include: bookingInclude,
    });

    await this.notificationsService.send({
      userId: booking.userId,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Booking fee updated',
      body: `The booking fee for ${booking.listing.listingTitle} was updated from $${previousFee} to $${dto.bookingFeeUsd} USD.`,
      metadata: {
        bookingId: booking.id,
        previousFeeUsd: previousFee,
        bookingFeeUsd: dto.bookingFeeUsd,
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
        previousFeeUsd: previousFee,
        bookingFeeUsd: dto.bookingFeeUsd,
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
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.status !== ListingStatus.PUBLISHED) {
      throw new BadRequestException('This vehicle is not available to book');
    }

    if (listing.isBooked) {
      throw new BadRequestException('This vehicle has already been booked');
    }

    const confirmedBooking = await this.prisma.vehicleBooking.findFirst({
      where: {
        listingId: listing.id,
        status: VehicleBookingStatus.CONFIRMED,
      },
    });

    if (confirmedBooking) {
      throw new BadRequestException('This vehicle has already been booked');
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

    const bookingFeeUsd = await this.getBookingFeeUsd();
    const validUntil = this.addDays(new Date(), BOOKING_VALIDITY_DAYS);

    const booking = await this.prisma.vehicleBooking.create({
      data: {
        bookingNumber,
        paymentReference,
        listingId: listing.id,
        userId,
        bookingFeeUsd,
        currency: 'USD',
        status: VehicleBookingStatus.AWAITING_PAYMENT,
        validUntil,
        notes: dto.notes,
      },
      include: bookingInclude,
    });

    await this.notificationsService.send({
      userId,
      type: NotificationType.INVOICE_ISSUED,
      title: 'Vehicle booking created',
      body: `Pay the booking fee of $${bookingFeeUsd} USD using reference ${paymentReference}.`,
      metadata: { bookingId: booking.id, listingId: listing.id },
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

    if (
      !BOOKING_PAYABLE_STATUSES.includes(
        booking.status as (typeof BOOKING_PAYABLE_STATUSES)[number],
      )
    ) {
      throw new BadRequestException(
        `Cannot submit payment for booking in status ${booking.status}`,
      );
    }

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
          bankName: dto.bankName,
          transferReference: dto.transferReference ?? booking.paymentReference,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          senderName: dto.senderName,
          notes: dto.notes ?? booking.notes,
          status: VehicleBookingStatus.UNDER_VERIFICATION,
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
      VehicleBookingStatus.REJECTED,
      VehicleBookingStatus.EXPIRED,
    ];

    const where = {
      userId,
      ...(filters.listingId ? { listingId: filters.listingId } : {}),
      ...(filters.status
        ? { status: filters.status }
        : { status: { notIn: inactiveStatuses } }),
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

    const { updated, supersededInvoices, supersededBookings } =
      await this.prisma.$transaction(async (tx) => {
        await tx.listing.update({
          where: { id: booking.listingId },
          data: { isBooked: true },
        });

        const supersededInvoices = await supersedeActiveInvoicesForListing(
          tx,
          booking.listingId,
        );
        const supersededBookings = await supersedeActiveBookingsForListing(
          tx,
          booking.listingId,
          booking.id,
        );

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

        return { updated: confirmed, supersededInvoices, supersededBookings };
      });

    await this.notificationsService.send({
      userId: booking.userId,
      type: NotificationType.PAYMENT_CONFIRMED,
      title: 'Vehicle booking confirmed',
      body: `Your booking for ${updated.listing.listingTitle} is confirmed.`,
      metadata: { bookingId: booking.id, listingId: booking.listingId },
    });

    for (const invoice of supersededInvoices) {
      await this.notificationsService.send({
        userId: invoice.userId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Vehicle no longer available',
        body: `${SUPERSEDED_BY_OTHER_BUYER_MESSAGE} Invoice ${invoice.invoiceNumber} was cancelled.`,
        metadata: { invoiceId: invoice.id, listingId: booking.listingId },
      });
    }

    for (const rival of supersededBookings) {
      await this.notificationsService.send({
        userId: rival.userId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Vehicle no longer available',
        body: `${SUPERSEDED_BY_OTHER_BUYER_MESSAGE} Booking ${rival.bookingNumber} was cancelled.`,
        metadata: { bookingId: rival.id, listingId: booking.listingId },
      });
    }

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

    if (booking.status !== VehicleBookingStatus.UNDER_VERIFICATION) {
      throw new BadRequestException(
        `Cannot reject booking in status ${booking.status}`,
      );
    }

    const updated = await this.prisma.vehicleBooking.update({
      where: { id: booking.id },
      data: {
        status: VehicleBookingStatus.REJECTED,
        rejectionReason: dto.reason,
        verifiedBy: adminId,
        verifiedAt: new Date(),
      },
      include: bookingInclude,
    });

    await this.notificationsService.send({
      userId: booking.userId,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Booking payment rejected',
      body:
        dto.reason ??
        'Your booking payment could not be verified. Please contact support.',
      metadata: { bookingId: booking.id },
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
