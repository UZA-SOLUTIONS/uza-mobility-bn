import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FleetRequestStatus, NotificationType, Prisma } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AddAssociationMemberDto } from './dto/add-association-member.dto';
import { CreateAssociationDto } from './dto/create-association.dto';
import { CreateFleetRequestDto } from './dto/create-fleet-request.dto';
import { FilterFleetRequestsDto } from './dto/filter-fleet.dto';
import { UpdateFleetRequestStatusDto } from './dto/update-fleet-request.dto';
import { FLEET_GUEST_EMAIL } from './fleet.constants';
import { canFleetTransition } from './fleet-transitions';

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  async submitRequest(dto: CreateFleetRequestDto, userId?: string) {
    const ownerId = await this.resolveUserId(userId);

    const request = await this.prisma.fleetRequest.create({
      data: {
        userId: ownerId,
        organizationName: dto.organizationName,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        buyerType: dto.buyerType,
        vehicleCategoryId: dto.vehicleCategoryId,
        vehicleSubcategoryId: dto.vehicleSubcategoryId,
        quantity: dto.quantity,
        useCase: dto.useCase,
        preferredDeliveryTimeline: dto.preferredDeliveryTimeline,
        budgetRangeMin: dto.budgetRangeMin,
        budgetRangeMax: dto.budgetRangeMax,
        financingRequested: dto.financingRequested ?? false,
        chargingSupportRequested: dto.chargingSupportRequested ?? false,
        associationId: dto.associationId,
        notes: dto.notes,
        status: FleetRequestStatus.SUBMITTED,
      },
    });

    await this.notificationsService.sendToRoleNames(
      ['FLEET_ADMIN', 'SUPER_ADMIN'],
      {
        type: NotificationType.FLEET_REQUEST_UPDATE,
        title: 'New fleet request',
        body: `${dto.organizationName} requested ${dto.quantity} vehicle(s).`,
        metadata: { fleetRequestId: request.id },
      },
    );

    return this.toPublicFleetRequest(request);
  }

  async findMine(userId: string, filters: FilterFleetRequestsDto) {
    return this.findPaginated({ userId }, filters, true);
  }

  async adminFindAll(filters: FilterFleetRequestsDto) {
    return this.findPaginated({}, filters, false);
  }

  async adminFindById(id: string) {
    const request = await this.prisma.fleetRequest.findUnique({
      where: { id },
      include: {
        association: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (!request) {
      throw new NotFoundException('Fleet request not found');
    }

    return request;
  }

  async updateStatus(
    id: string,
    dto: UpdateFleetRequestStatusDto,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const request = await this.prisma.fleetRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Fleet request not found');
    }

    if (!canFleetTransition(request.status, dto.status)) {
      throw new BadRequestException(
        `Cannot transition fleet request from ${request.status} to ${dto.status}`,
      );
    }

    const updated = await this.prisma.fleetRequest.update({
      where: { id },
      data: {
        status: dto.status,
        adminNotes: dto.adminNotes,
        quotedAt:
          dto.status === FleetRequestStatus.QUOTED
            ? new Date()
            : request.quotedAt,
      },
    });

    await this.notificationsService.send({
      userId: request.userId,
      type: NotificationType.FLEET_REQUEST_UPDATE,
      title: 'Fleet request updated',
      body: `Your fleet request for ${request.organizationName} is now ${dto.status}.`,
      metadata: { fleetRequestId: id, status: dto.status },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'fleet:status-updated',
      entity: 'FleetRequest',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        fleetRequestId: id,
        from: request.status,
        to: dto.status,
      },
    });

    return this.toPublicFleetRequest(updated);
  }

  async createAssociation(dto: CreateAssociationDto) {
    return this.prisma.association.create({ data: dto });
  }

  async listAssociations() {
    return this.prisma.association.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true, fleetRequests: true } } },
    });
  }

  async addAssociationMember(
    associationId: string,
    dto: AddAssociationMemberDto,
  ) {
    await this.getAssociationOrThrow(associationId);

    return this.prisma.associationMember.create({
      data: {
        associationId,
        userId: dto.userId,
        memberName: dto.memberName,
        phone: dto.phone,
        email: dto.email,
        role: dto.role,
      },
    });
  }

  private async findPaginated(
    where: Prisma.FleetRequestWhereInput,
    filters: FilterFleetRequestsDto,
    hideAdminNotes: boolean,
  ) {
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.q) {
      where.OR = [
        { organizationName: { contains: filters.q, mode: 'insensitive' } },
        { contactPerson: { contains: filters.q, mode: 'insensitive' } },
        { phone: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      this.prisma.fleetRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.fleetRequest.count({ where }),
    ]);

    return {
      items: rows.map((row) => this.toPublicFleetRequest(row, hideAdminNotes)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private toPublicFleetRequest<T extends { adminNotes?: string | null }>(
    request: T,
    stripAdminNotes = true,
  ) {
    if (!stripAdminNotes) {
      return request;
    }

    const { adminNotes: _adminNotes, ...rest } = request;
    return rest;
  }

  private async resolveUserId(userId?: string): Promise<string> {
    if (userId) {
      return userId;
    }

    const guest = await this.prisma.user.findUnique({
      where: { email: FLEET_GUEST_EMAIL },
    });

    if (!guest) {
      throw new NotFoundException(
        `Fleet guest user (${FLEET_GUEST_EMAIL}) is missing — run prisma:seed`,
      );
    }

    return guest.id;
  }

  private async getAssociationOrThrow(id: string) {
    const association = await this.prisma.association.findUnique({
      where: { id },
    });

    if (!association) {
      throw new NotFoundException('Association not found');
    }

    return association;
  }
}
