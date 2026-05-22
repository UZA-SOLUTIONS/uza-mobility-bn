import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, OrderStatus, Prisma } from '@prisma/client';
import { generateReferenceNumber } from '../../common/utils/reference-number.util';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { orderDetailInclude } from './orders.constants';
import { getNextOrderStatus, ORDER_STAGES, STAGE_LABELS } from './order-stages';
import { SustainabilityService } from '../sustainability/sustainability.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly sustainabilityService: SustainabilityService,
  ) {}

  async createFromInvoice(invoiceId: string) {
    const existing = await this.prisma.order.findUnique({
      where: { invoiceId },
      include: orderDetailInclude,
    });

    if (existing) {
      return existing;
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { listing: true },
    });

    if (!invoice?.listingId || !invoice.listing) {
      throw new BadRequestException(
        'Order requires an invoice linked to a listing',
      );
    }

    const sellerType = invoice.sellerType ?? invoice.listing.sellerType;
    const orderNumber = await generateReferenceNumber(this.prisma, 'UZM-ORD');

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: invoice.userId,
          listingId: invoice.listingId!,
          invoiceId: invoice.id,
          sellerType,
          status: OrderStatus.PAYMENT_CONFIRMED,
        },
      });

      await tx.orderTrackingEvent.create({
        data: {
          orderId: newOrder.id,
          stage: OrderStatus.PAYMENT_CONFIRMED,
          title: STAGE_LABELS[OrderStatus.PAYMENT_CONFIRMED],
          description:
            'Your payment has been verified. Your order is now being processed.',
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: newOrder.id },
        include: orderDetailInclude,
      });
    });

    await this.notificationsService.send({
      userId: invoice.userId,
      type: NotificationType.ORDER_STATUS_UPDATED,
      title: 'Order created',
      body: `Order ${orderNumber} has been created. We will keep you updated.`,
      metadata: { orderId: order.id },
    });

    return order;
  }

  async findMine(userId: string, filters: FilterOrdersDto) {
    return this.findPaginated({ userId }, filters);
  }

  async findTrackingForUser(userId: string, orderId: string) {
    const order = await this.getOrderOrThrow(orderId);

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        sellerType: order.sellerType,
        stages: ORDER_STAGES[order.sellerType],
      },
      events: order.trackingEvents,
    };
  }

  async adminFindAll(filters: FilterOrdersDto) {
    const where: Prisma.OrderWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.sellerType) {
      where.sellerType = filters.sellerType;
    }

    if (filters.q) {
      where.OR = [
        { orderNumber: { contains: filters.q, mode: 'insensitive' } },
        { user: { email: { contains: filters.q, mode: 'insensitive' } } },
        {
          listing: {
            listingTitle: { contains: filters.q, mode: 'insensitive' },
          },
        },
      ];
    }

    return this.findPaginated(where, filters);
  }

  async adminFindById(orderId: string) {
    return this.getOrderOrThrow(orderId);
  }

  async advanceOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const order = await this.getOrderOrThrow(orderId);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cancelled orders cannot be advanced');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Order is already at final stage');
    }

    const next = getNextOrderStatus(order.sellerType, order.status);

    if (!next) {
      throw new BadRequestException('Order is already at final stage');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.order.update({
        where: { id: orderId },
        data: {
          status: next,
          actualDeliveryDate:
            next === OrderStatus.DELIVERED ? new Date() : undefined,
        },
        include: orderDetailInclude,
      });

      await tx.orderTrackingEvent.create({
        data: {
          orderId,
          stage: next,
          title: STAGE_LABELS[next],
          description: dto.description,
          location: dto.location,
          performedBy: adminUserId,
        },
      });

      return row;
    });

    if (next === OrderStatus.DELIVERED) {
      await this.sustainabilityService.recordDelivery(orderId);
    }

    await this.notificationsService.send({
      userId: order.userId,
      type: NotificationType.ORDER_STATUS_UPDATED,
      title: STAGE_LABELS[next],
      body:
        dto.description ??
        `Your order status has been updated to: ${STAGE_LABELS[next]}`,
      metadata: { orderId, status: next },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'orders:status-updated',
      entity: 'Order',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        orderNumber: order.orderNumber,
        from: order.status,
        to: next,
      },
    });

    return updated;
  }

  async cancelOrder(
    orderId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const order = await this.getOrderOrThrow(orderId);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: orderDetailInclude,
      });

      await tx.orderTrackingEvent.create({
        data: {
          orderId,
          stage: OrderStatus.CANCELLED,
          title: STAGE_LABELS[OrderStatus.CANCELLED],
          description: 'Order cancelled by administrator',
          performedBy: adminUserId,
        },
      });

      return row;
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'orders:cancelled',
      entity: 'Order',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        orderNumber: order.orderNumber,
      },
    });

    return updated;
  }

  private async findPaginated(
    where: Prisma.OrderWhereInput,
    filters: FilterOrdersDto,
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: orderDetailInclude,
      }),
      this.prisma.order.count({ where }),
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

  private async getOrderOrThrow(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: orderDetailInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
}
