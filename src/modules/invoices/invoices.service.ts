import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  InvoiceType,
  ListingStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { generateReferenceNumber } from '../../common/utils/reference-number.util';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { canTransition } from '../listings/listing-transitions';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFleetInvoiceDto } from './dto/create-fleet-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import { RequestInvoiceDto } from './dto/request-invoice.dto';
import {
  ACTIVE_INVOICE_STATUSES,
  BUYER_CANCELLABLE_INVOICE_STATUSES,
  INACTIVE_INVOICE_STATUSES,
  INVOICE_VALIDITY_DAYS,
  PAYABLE_INVOICE_STATUSES,
} from './invoice.constants';
import { ACTIVE_BOOKING_STATUSES } from '../bookings/booking.constants';
import { snapshotPricingFields, toBuyerInvoice } from './invoice.mapper';
import { InvoicePdfService } from './invoice-pdf.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly pricingService: PricingService,
  ) {}

  async requestInvoice(
    userId: string,
    dto: RequestInvoiceDto,
    auditContext: RequestAuditContext = {},
  ) {
    const [user, listing] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { buyerProfile: true },
      }),
      this.prisma.listing.findFirst({
        where: {
          id: dto.listingId,
          status: ListingStatus.PUBLISHED,
          deletedAt: null,
        },
        include: { listingPricing: true, seller: true },
      }),
    ]);

    if (!user || !user.isActive || user.deletedAt) {
      throw new ForbiddenException('Account is not active');
    }

    if (!user.buyerProfile) {
      throw new BadRequestException(
        'Complete your buyer profile before requesting an invoice',
      );
    }

    if (!listing) {
      throw new NotFoundException('Published listing not found');
    }

    if (!listing.listingPricing) {
      throw new BadRequestException(
        'Listing has no pricing — cannot issue invoice',
      );
    }

    if (listing.isBooked) {
      throw new BadRequestException('This vehicle is booked by another buyer');
    }

    const activeBooking = await this.prisma.vehicleBooking.findFirst({
      where: {
        listingId: listing.id,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
      },
    });

    if (activeBooking) {
      throw new BadRequestException(
        'This vehicle has an active booking. Complete or cancel it before requesting an invoice.',
      );
    }

    const blocking = await this.prisma.invoice.findFirst({
      where: {
        listingId: listing.id,
        status: { in: ACTIVE_INVOICE_STATUSES },
      },
    });

    if (blocking) {
      throw new BadRequestException(
        'This vehicle already has an active invoice or reservation',
      );
    }

    if (!canTransition(listing.status, ListingStatus.RESERVED)) {
      throw new BadRequestException('Listing cannot be reserved');
    }

    const [invoiceNumber, paymentReference] = await Promise.all([
      generateReferenceNumber(this.prisma, 'UZM-INV'),
      generateReferenceNumber(this.prisma, 'UZM-PAY'),
    ]);

    const validUntil = this.addDays(new Date(), INVOICE_VALIDITY_DAYS);
    const company =
      await this.platformSettingsService.getCompanyPaymentDetails();

    const totalAmountUsd = listing.listingPricing.finalPriceUsd;

    const invoice = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          paymentReference,
          userId,
          listingId: listing.id,
          invoiceType: dto.invoiceType ?? InvoiceType.PROFORMA,
          status: InvoiceStatus.SENT,
          buyerName: `${user.firstName} ${user.lastName}`.trim(),
          buyerEmail: user.email,
          buyerPhone: user.phone,
          buyerAddress: dto.buyerAddress,
          buyerType: user.buyerProfile?.buyerType ?? undefined,
          vehicleBrand: listing.brand,
          vehicleModel: listing.model,
          vehicleTrim: listing.trim,
          vehicleYear: listing.manufacturingYear,
          vehicleCondition: listing.condition,
          vehicleLocation: listing.vehicleLocation,
          sellerType: listing.sellerType,
          verificationLevel: listing.verificationLevel,
          ...snapshotPricingFields(listing.listingPricing),
          beneficiaryName: company.legalName,
          bankName: company.bankName,
          accountNumber: company.accountNumber,
          paymentDeadline: validUntil,
          validUntil,
          notes: dto.notes,
          issuedAt: new Date(),
          deliveryEstimate: listing.deliveryEstimateDays
            ? `${listing.deliveryEstimateDays} days`
            : undefined,
        },
      });

      await tx.listing.update({
        where: { id: listing.id },
        data: { status: ListingStatus.RESERVED },
      });

      return inv;
    });

    void this.invoicePdfService.generate(invoice.id).catch(() => undefined);

    await this.notificationsService.send({
      userId,
      type: NotificationType.INVOICE_ISSUED,
      title: 'Your invoice is ready',
      body: `Invoice ${invoiceNumber} has been issued. Payment reference: ${paymentReference}`,
      metadata: { invoiceId: invoice.id, listingId: listing.id },
    });

    await this.auditService.record({
      userId,
      action: 'invoices:requested',
      entity: 'Invoice',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        invoiceNumber,
        listingId: listing.id,
      },
    });

    return toBuyerInvoice(invoice);
  }

  async findMine(userId: string, filters: FilterInvoicesDto) {
    return this.findPaginated(
      this.buildInvoiceWhere({ userId }, filters),
      filters,
    );
  }

  async adminFindAll(filters: FilterInvoicesDto) {
    return this.findPaginated(this.buildInvoiceWhere({}, filters), filters);
  }

  private buildInvoiceWhere(
    base: Prisma.InvoiceWhereInput,
    filters: FilterInvoicesDto,
  ): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = { ...base };

    if (filters.pendingPurchase) {
      where.status = { in: ACTIVE_INVOICE_STATUSES };
    } else if (filters.payableOnly) {
      where.status = { in: PAYABLE_INVOICE_STATUSES };
    } else if (filters.status) {
      where.status = filters.status;
    } else {
      where.status = { notIn: INACTIVE_INVOICE_STATUSES };
    }

    if (filters.listingId) {
      where.listingId = filters.listingId;
    }

    if (filters.q) {
      where.OR = [
        { invoiceNumber: { contains: filters.q, mode: 'insensitive' } },
        { paymentReference: { contains: filters.q, mode: 'insensitive' } },
        { buyerName: { contains: filters.q, mode: 'insensitive' } },
        { buyerEmail: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async findByIdForUser(userId: string, invoiceId: string, isAdmin: boolean) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        listing: { select: { slug: true, listingTitle: true } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (!isAdmin && invoice.userId !== userId) {
      throw new ForbiddenException('You do not have access to this invoice');
    }

    return toBuyerInvoice(invoice);
  }

  async createFleetInvoice(
    adminUserId: string,
    dto: CreateFleetInvoiceDto,
    auditContext: RequestAuditContext = {},
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException('Buyer user not found');
    }

    const [invoiceNumber, paymentReference] = await Promise.all([
      generateReferenceNumber(this.prisma, 'UZM-INV'),
      generateReferenceNumber(this.prisma, 'UZM-PAY'),
    ]);

    const validUntil = this.addDays(new Date(), INVOICE_VALIDITY_DAYS);
    const company =
      await this.platformSettingsService.getCompanyPaymentDetails();

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        paymentReference,
        userId: dto.userId,
        listingId: dto.listingId,
        invoiceType: dto.invoiceType ?? InvoiceType.FLEET,
        status: InvoiceStatus.SENT,
        buyerName: dto.buyerName,
        buyerEmail: dto.buyerEmail ?? user.email,
        buyerPhone: dto.buyerPhone ?? user.phone,
        buyerAddress: dto.buyerAddress,
        vehicleBrand: dto.vehicleBrand,
        vehicleModel: dto.vehicleModel,
        totalAmountUsd: dto.totalAmountUsd,
        currency: 'USD',
        beneficiaryName: company.legalName,
        bankName: company.bankName,
        accountNumber: company.accountNumber,
        paymentDeadline: validUntil,
        validUntil,
        notes: dto.notes,
        issuedAt: new Date(),
      },
    });

    void this.invoicePdfService.generate(invoice.id).catch(() => undefined);

    await this.notificationsService.send({
      userId: dto.userId,
      type: NotificationType.INVOICE_ISSUED,
      title: 'Fleet invoice issued',
      body: `Invoice ${invoiceNumber} has been created for you.`,
      metadata: { invoiceId: invoice.id },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'invoices:fleet-created',
      entity: 'Invoice',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        invoiceNumber,
        buyerUserId: dto.userId,
      },
    });

    return toBuyerInvoice(invoice);
  }

  async cancelInvoiceByBuyer(
    userId: string,
    invoiceId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.userId !== userId) {
      throw new ForbiddenException('You do not own this invoice');
    }

    if (!BUYER_CANCELLABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new BadRequestException(
        'This reservation can only be cancelled before payment proof is submitted',
      );
    }

    const paymentCount = await this.prisma.payment.count({
      where: { invoiceId: invoice.id },
    });

    if (paymentCount > 0) {
      throw new BadRequestException(
        'Cannot cancel after a payment has been submitted',
      );
    }

    const updated = await this.executeInvoiceCancellation(
      invoice.id,
      invoice.listingId,
    );

    await this.notificationsService.send({
      userId,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Reservation cancelled',
      body: `Invoice ${invoice.invoiceNumber} was cancelled. The vehicle is available to reserve again if still listed.`,
      metadata: { invoiceId: invoice.id, listingId: invoice.listingId },
    });

    await this.notifyAdminsReservationCancelled(invoice, userId);

    await this.auditService.record({
      userId,
      action: 'invoices:buyer-cancelled',
      entity: 'Invoice',
      entityId: invoice.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    return toBuyerInvoice(updated);
  }

  async cancelInvoice(
    adminUserId: string,
    invoiceId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const invoice = await this.getInvoiceOrThrow(invoiceId);

    if (
      invoice.status === InvoiceStatus.CANCELLED ||
      invoice.status === InvoiceStatus.PAYMENT_CONFIRMED ||
      invoice.status === InvoiceStatus.FULLY_PAID
    ) {
      throw new BadRequestException(
        `Cannot cancel invoice in status ${invoice.status}`,
      );
    }

    const updated = await this.executeInvoiceCancellation(
      invoice.id,
      invoice.listingId,
    );

    await this.auditService.record({
      userId: adminUserId,
      action: 'invoices:cancelled',
      entity: 'Invoice',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    return toBuyerInvoice(updated);
  }

  async expireDueInvoices(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.invoice.findMany({
      where: {
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.AWAITING_PAYMENT] },
        validUntil: { lt: now },
      },
    });

    for (const invoice of expired) {
      await this.prisma.$transaction(async (tx) => {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.EXPIRED },
        });

        if (invoice.listingId) {
          const listing = await tx.listing.findUnique({
            where: { id: invoice.listingId },
          });

          if (listing?.status === ListingStatus.RESERVED) {
            await tx.listing.update({
              where: { id: invoice.listingId },
              data: { status: ListingStatus.PUBLISHED },
            });
          }
        }
      });

      await this.notificationsService.send({
        userId: invoice.userId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Invoice expired',
        body: `Invoice ${invoice.invoiceNumber} has expired. The vehicle is available again if still listed.`,
        metadata: { invoiceId: invoice.id },
      });
    }

    return expired.length;
  }

  private async findPaginated(
    where: Prisma.InvoiceWhereInput,
    filters: FilterInvoicesDto,
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: rows.map(toBuyerInvoice),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private async executeInvoiceCancellation(
    invoiceId: string,
    listingId: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.CANCELLED },
      });

      if (listingId) {
        const listing = await tx.listing.findUnique({
          where: { id: listingId },
        });

        if (listing?.status === ListingStatus.RESERVED) {
          await tx.listing.update({
            where: { id: listingId },
            data: { status: ListingStatus.PUBLISHED },
          });
        }
      }

      return inv;
    });
  }

  private async notifyAdminsReservationCancelled(
    invoice: {
      id: string;
      invoiceNumber: string;
      buyerName: string;
      vehicleBrand: string | null;
      vehicleModel: string | null;
      listingId: string | null;
    },
    buyerUserId: string,
  ) {
    const vehicleLabel =
      invoice.vehicleBrand && invoice.vehicleModel
        ? `${invoice.vehicleBrand} ${invoice.vehicleModel}`
        : 'a vehicle';

    await this.notificationsService.sendToRoleNames(
      ['FINANCE_ADMIN', 'SUPER_ADMIN'],
      {
        type: NotificationType.SYSTEM_ALERT,
        title: 'Buyer cancelled reservation',
        body: `${invoice.buyerName} cancelled invoice ${invoice.invoiceNumber} for ${vehicleLabel}.`,
        metadata: {
          invoiceId: invoice.id,
          userId: buyerUserId,
          listingId: invoice.listingId,
        },
      },
    );
  }

  private async getInvoiceOrThrow(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
