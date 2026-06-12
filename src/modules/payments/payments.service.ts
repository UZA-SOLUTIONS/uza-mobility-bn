import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  ListingStatus,
  NotificationType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { SUPERSEDED_BY_OTHER_BUYER_MESSAGE } from '../commerce/supersede.constants';
import {
  supersedeActiveBookingsForListing,
  supersedeActiveInvoicesForListing,
} from '../commerce/supersede.util';
import { canTransition } from '../listings/listing-transitions';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterPaymentsDto } from './dto/filter-payments.dto';
import { MarkPartialPaymentDto } from './dto/partial-payment.dto';
import { RejectPaymentDto } from './dto/reject-payment.dto';
import type { SubmitPaymentPayload } from './dto/payment-write.types';
import { canPaymentTransition } from './payment-transitions';

const PAYABLE_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.AWAITING_PAYMENT,
  InvoiceStatus.PARTIALLY_PAID,
];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly ordersService: OrdersService,
  ) {}

  async submitPayment(
    userId: string,
    dto: SubmitPaymentPayload,
    auditContext: RequestAuditContext = {},
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: { listing: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.userId !== userId) {
      throw new ForbiddenException('You do not own this invoice');
    }

    if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new BadRequestException(
        `Cannot submit payment for invoice in status ${invoice.status}`,
      );
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amountPaid: dto.amountPaid,
          currency: dto.currency ?? invoice.currency,
          bankName: dto.bankName,
          transferReference: dto.transferReference ?? invoice.paymentReference,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          senderName: dto.senderName,
          notes: dto.notes,
          status: PaymentStatus.UNDER_VERIFICATION,
        },
      });

      if (dto.proofUrls?.length) {
        await tx.paymentProof.createMany({
          data: dto.proofUrls.map((url) => ({
            paymentId: created.id,
            fileUrl: url,
            fileType: this.inferFileType(url),
            fileName: url.split('/').pop() ?? 'proof',
          })),
        });
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAYMENT_SUBMITTED },
      });

      return tx.payment.findUniqueOrThrow({
        where: { id: created.id },
        include: { proofs: true, invoice: true },
      });
    });

    await this.notificationsService.sendToRoleNames(
      ['FINANCE_ADMIN', 'SUPER_ADMIN'],
      {
        type: NotificationType.SYSTEM_ALERT,
        title: 'Payment proof submitted',
        body: `Payment submitted for invoice ${invoice.invoiceNumber}.`,
        metadata: {
          invoiceId: invoice.id,
          paymentId: payment.id,
          amountPaid: dto.amountPaid,
        },
      },
    );

    await this.auditService.record({
      userId,
      action: 'payments:submitted',
      entity: 'Payment',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        invoiceNumber: invoice.invoiceNumber,
        paymentId: payment.id,
      },
    });

    return payment;
  }

  async findMine(userId: string, filters: FilterPaymentsDto) {
    return this.findPaginated({ invoice: { userId } }, filters);
  }

  async adminFindAll(filters: FilterPaymentsDto) {
    const where: Prisma.PaymentWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.invoiceId) {
      where.invoiceId = filters.invoiceId;
    }

    return this.findPaginated(where, filters);
  }

  async confirmPayment(
    paymentId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const payment = await this.getPaymentOrThrow(paymentId);

    this.assertPaymentTransition(payment.status, PaymentStatus.CONFIRMED);

    const listingId = payment.invoice.listingId;
    const { supersededInvoices, supersededBookings } =
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: PaymentStatus.CONFIRMED,
            verifiedBy: adminUserId,
            verifiedAt: new Date(),
          },
        });

        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: InvoiceStatus.PAYMENT_CONFIRMED },
        });

        let supersededInvoices: Awaited<
          ReturnType<typeof supersedeActiveInvoicesForListing>
        > = [];
        let supersededBookings: Awaited<
          ReturnType<typeof supersedeActiveBookingsForListing>
        > = [];

        if (listingId) {
          const listing = await tx.listing.findUnique({
            where: { id: listingId },
          });

          if (listing && canTransition(listing.status, ListingStatus.SOLD)) {
            await tx.listing.update({
              where: { id: listingId },
              data: { status: ListingStatus.SOLD, isBooked: false },
            });
          }

          supersededInvoices = await supersedeActiveInvoicesForListing(
            tx,
            listingId,
            payment.invoiceId,
          );
          supersededBookings = await supersedeActiveBookingsForListing(
            tx,
            listingId,
          );
        }

        return { supersededInvoices, supersededBookings };
      });

    await this.ordersService.createFromInvoice(payment.invoiceId);

    await this.notificationsService.send({
      userId: payment.invoice.userId,
      type: NotificationType.PAYMENT_CONFIRMED,
      title: 'Payment confirmed',
      body: `Your payment for invoice ${payment.invoice.invoiceNumber} has been confirmed.`,
      metadata: {
        invoiceId: payment.invoiceId,
        paymentId,
      },
    });

    for (const invoice of supersededInvoices) {
      await this.notificationsService.send({
        userId: invoice.userId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Vehicle no longer available',
        body: `${SUPERSEDED_BY_OTHER_BUYER_MESSAGE} Invoice ${invoice.invoiceNumber} was cancelled.`,
        metadata: { invoiceId: invoice.id, listingId },
      });
    }

    for (const booking of supersededBookings) {
      await this.notificationsService.send({
        userId: booking.userId,
        type: NotificationType.SYSTEM_ALERT,
        title: 'Vehicle no longer available',
        body: `${SUPERSEDED_BY_OTHER_BUYER_MESSAGE} Booking ${booking.bookingNumber} was cancelled.`,
        metadata: { bookingId: booking.id, listingId },
      });
    }

    await this.auditService.record({
      userId: adminUserId,
      action: 'payments:confirmed',
      entity: 'Payment',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        invoiceId: payment.invoiceId,
        amountPaid: payment.amountPaid,
      },
    });

    return this.getPaymentOrThrow(paymentId);
  }

  async rejectPayment(
    paymentId: string,
    adminUserId: string,
    dto: RejectPaymentDto,
    auditContext: RequestAuditContext = {},
  ) {
    const payment = await this.getPaymentOrThrow(paymentId);

    this.assertPaymentTransition(payment.status, PaymentStatus.REJECTED);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.REJECTED,
          rejectionReason: dto.reason,
          verifiedBy: adminUserId,
          verifiedAt: new Date(),
        },
      });

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { status: InvoiceStatus.AWAITING_PAYMENT },
      });
    });

    await this.notificationsService.send({
      userId: payment.invoice.userId,
      type: NotificationType.PAYMENT_REJECTED,
      title: 'Payment not verified',
      body: `Your payment for invoice ${payment.invoice.invoiceNumber} was rejected: ${dto.reason}`,
      metadata: {
        invoiceId: payment.invoiceId,
        paymentId,
        reason: dto.reason,
      },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'payments:rejected',
      entity: 'Payment',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        invoiceId: payment.invoiceId,
        reason: dto.reason,
      },
    });

    return this.getPaymentOrThrow(paymentId);
  }

  async markPartial(
    paymentId: string,
    adminUserId: string,
    dto: MarkPartialPaymentDto,
    auditContext: RequestAuditContext = {},
  ) {
    const payment = await this.getPaymentOrThrow(paymentId);

    if (payment.status !== PaymentStatus.UNDER_VERIFICATION) {
      throw new BadRequestException(
        'Only payments under verification can be marked partial',
      );
    }

    await this.prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: InvoiceStatus.PARTIALLY_PAID },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'payments:partial',
      entity: 'Payment',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        invoiceId: payment.invoiceId,
        amountReceived: dto.amountReceived,
        notes: dto.notes,
      },
    });

    return this.getPaymentOrThrow(paymentId);
  }

  private async findPaginated(
    where: Prisma.PaymentWhereInput,
    filters: FilterPaymentsDto,
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              paymentReference: true,
              totalAmountUsd: true,
              status: true,
            },
          },
          proofs: true,
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private async getPaymentOrThrow(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { invoice: true, proofs: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  private assertPaymentTransition(from: PaymentStatus, to: PaymentStatus) {
    if (!canPaymentTransition(from, to)) {
      throw new BadRequestException(
        `Cannot transition payment from ${from} to ${to}`,
      );
    }
  }

  private inferFileType(url: string): string {
    const lower = url.split('?')[0].toLowerCase();
    if (lower.endsWith('.pdf')) return 'PDF';
    if (lower.endsWith('.png')) return 'PNG';
    if (lower.endsWith('.webp')) return 'WEBP';
    return 'JPG';
  }
}
