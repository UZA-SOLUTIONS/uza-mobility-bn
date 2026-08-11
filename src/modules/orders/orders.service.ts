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
import {
  AssignOrderFulfillmentDto,
  UpsertShipmentDto,
} from './dto/fulfillment.dto';
import { orderDetailInclude } from './orders.constants';
import {
  getNextOrderStatus,
  ORDER_STAGES,
  STAGE_BUYER_MESSAGES,
  STAGE_LABELS,
} from './order-stages';
import { SustainabilityService } from '../sustainability/sustainability.service';
import { toAbsoluteUploadUrl } from '../../common/uploads/storage.paths';

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

    const previousStatus = order.status;
    const adminNote = dto.description?.trim() || null;
    const location = dto.location?.trim() || null;

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
          description: adminNote,
          location,
          performedBy: adminUserId,
        },
      });

      return row;
    });

    if (next === OrderStatus.DELIVERED) {
      await this.sustainabilityService.recordDelivery(orderId);
    }

    const bodyParts = [
      `Your order ${order.orderNumber} moved from ${STAGE_LABELS[previousStatus]} to ${STAGE_LABELS[next]}.`,
      STAGE_BUYER_MESSAGES[next],
    ];
    if (location) {
      bodyParts.push(`Location: ${location}`);
    }
    if (adminNote) {
      bodyParts.push(`Note from our team: ${adminNote}`);
    }
    bodyParts.push(
      'You can track progress anytime in your UZA Mobility account.',
    );

    await this.notificationsService.send({
      userId: order.userId,
      type: NotificationType.ORDER_STATUS_UPDATED,
      title: `Order update: ${STAGE_LABELS[next]}`,
      body: bodyParts.join('\n\n'),
      emailSubject: `Order ${order.orderNumber}: ${STAGE_LABELS[next]}`,
      metadata: {
        orderId,
        status: next,
        from: previousStatus,
        to: next,
      },
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
        from: previousStatus,
        to: next,
      },
    });

    return updated;
  }

  async upsertShipment(
    dto: UpsertShipmentDto,
    arrivalNoticeFileUrl?: string,
    adminUserId?: string,
    auditContext: RequestAuditContext = {},
  ) {
    const shipment = await this.prisma.shipment.create({
      data: {
        documentNumber: dto.documentNumber?.trim() || null,
        vesselName: dto.vesselName?.trim() || null,
        voyageNumber: dto.voyageNumber?.trim() || null,
        etaAt: dto.etaAt ? new Date(dto.etaAt) : null,
        portOfLoading: dto.portOfLoading?.trim() || null,
        portOfDischarge: dto.portOfDischarge?.trim() || null,
        terminalOfPickup: dto.terminalOfPickup?.trim() || null,
        finalPlaceOfDelivery: dto.finalPlaceOfDelivery?.trim() || null,
        containerNumber: dto.containerNumber?.trim() || null,
        sealNumber: dto.sealNumber?.trim() || null,
        carrierTrackUrl:
          dto.carrierTrackUrl?.trim() ||
          (dto.containerNumber?.trim()
            ? `https://www.msc.com/track-a-shipment?query=${encodeURIComponent(dto.containerNumber.trim())}`
            : null),
        arrivalNoticeFileUrl: arrivalNoticeFileUrl
          ? toAbsoluteUploadUrl(arrivalNoticeFileUrl)
          : null,
        notes: dto.notes?.trim() || null,
      },
    });

    if (dto.orderIds?.length) {
      await this.prisma.order.updateMany({
        where: { id: { in: dto.orderIds } },
        data: { shipmentId: shipment.id },
      });
    }

    if (adminUserId) {
      await this.auditService.record({
        userId: adminUserId,
        action: 'shipments:created',
        entity: 'Shipment',
        entityId: shipment.id,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        metadata: {
          containerNumber: shipment.containerNumber,
          orderIds: dto.orderIds ?? [],
        },
      });
    }

    return shipment;
  }

  async assignFulfillment(
    orderId: string,
    dto: AssignOrderFulfillmentDto,
    arrivalNoticeFileUrl: string | undefined,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const order = await this.getOrderOrThrow(orderId);
    let shipmentId = dto.shipmentId ?? order.shipmentId ?? null;

    if (dto.shipment) {
      const shipment = await this.upsertShipment(
        {
          ...dto.shipment,
          orderIds: [orderId, ...(dto.shipment.orderIds ?? [])],
        },
        arrivalNoticeFileUrl,
        adminUserId,
        auditContext,
      );
      shipmentId = shipment.id;
    } else if (dto.shipmentId) {
      const exists = await this.prisma.shipment.findUnique({
        where: { id: dto.shipmentId },
      });
      if (!exists) {
        throw new NotFoundException('Shipment not found');
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        vin: dto.vin.trim().toUpperCase(),
        shipmentId,
      },
      include: orderDetailInclude,
    });

    await this.notificationsService.send({
      userId: order.userId,
      type: NotificationType.SHIPMENT_UPDATE,
      title: 'Shipping details updated',
      body: this.buildBuyerShipmentBody(updated),
      metadata: {
        orderId,
        vin: updated.vin,
        containerNumber: updated.shipment?.containerNumber,
      },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'orders:fulfillment-assigned',
      entity: 'Order',
      entityId: orderId,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { vin: updated.vin, shipmentId },
    });

    return updated;
  }

  async notifyPortArrival(orderId: string, adminUserId: string) {
    const order = await this.getOrderOrThrow(orderId);
    if (!order.shipment) {
      throw new BadRequestException(
        'Assign shipment / arrival notice details before notifying the buyer',
      );
    }

    const body = this.buildBuyerShipmentBody(order, true);
    await this.notificationsService.send({
      userId: order.userId,
      type: NotificationType.SHIPMENT_UPDATE,
      title: 'Your vehicle has arrived at port',
      body,
      metadata: {
        orderId,
        vin: order.vin,
        containerNumber: order.shipment.containerNumber,
      },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'orders:port-notified',
      entity: 'Order',
      entityId: orderId,
    });

    return {
      order,
      buyerEmail: order.user?.email ?? null,
      message: body,
    };
  }

  private buildBuyerShipmentBody(
    order: {
      listing?: { listingTitle?: string } | null;
      vin?: string | null;
      shipment?: {
        containerNumber?: string | null;
        vesselName?: string | null;
        voyageNumber?: string | null;
        etaAt?: Date | null;
        portOfDischarge?: string | null;
        terminalOfPickup?: string | null;
        carrierTrackUrl?: string | null;
      } | null;
    },
    atPort = false,
  ): string {
    const title = order.listing?.listingTitle ?? 'your vehicle';
    const parts = [
      atPort
        ? `Good news — ${title} has an arrival notice at port.`
        : `Shipping details for ${title} were updated.`,
    ];
    if (order.vin) parts.push(`VIN: ${order.vin}`);
    if (order.shipment?.containerNumber) {
      parts.push(`Container: ${order.shipment.containerNumber}`);
    }
    if (order.shipment?.vesselName) {
      parts.push(
        `Vessel: ${order.shipment.vesselName}${
          order.shipment.voyageNumber ? ` / ${order.shipment.voyageNumber}` : ''
        }`,
      );
    }
    if (order.shipment?.etaAt) {
      parts.push(`ETA: ${order.shipment.etaAt.toISOString().slice(0, 10)}`);
    }
    if (order.shipment?.portOfDischarge) {
      parts.push(
        `Port: ${order.shipment.portOfDischarge}${
          order.shipment.terminalOfPickup
            ? ` (${order.shipment.terminalOfPickup})`
            : ''
        }`,
      );
    }
    if (order.shipment?.carrierTrackUrl) {
      parts.push(`Track: ${order.shipment.carrierTrackUrl}`);
    }
    parts.push(
      'Our team is arranging the next steps toward Kigali. Reply if you have questions.',
    );
    return parts.join(' ');
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
