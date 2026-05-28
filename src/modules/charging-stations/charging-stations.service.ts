import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  OperatorStatus,
  PortStatus,
  Prisma,
  StationStatus,
  StationOperationalStatus,
} from '@prisma/client';
import { resolveUniqueSlug } from '../../common/utils/slug.util';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateChargingPortDto } from './dto/create-charging-port.dto';
import { CreateOperatorProfileDto } from './dto/create-operator-profile.dto';
import { CreateStationDto } from './dto/create-station.dto';
import { CreateStationPricingDto } from './dto/create-station-pricing.dto';
import { CreateVehicleCompatibilityDto } from './dto/create-vehicle-compatibility.dto';
import { FilterStationsDto } from './dto/filter-stations.dto';
import { StationReviewActionDto } from './dto/station-review-action.dto';
import { UpdateChargingPortDto } from './dto/update-charging-port.dto';
import { UpdateOperatorProfileDto } from './dto/update-operator-profile.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import { canStationTransition } from './station-transitions';

const stationInclude = {
  operator: {
    select: {
      id: true,
      businessName: true,
      city: true,
      country: true,
      status: true,
    },
  },
  ports: {
    orderBy: { createdAt: 'asc' },
  },
  pricing: {
    where: { isActive: true },
    orderBy: { validFrom: 'desc' },
  },
  compatibleVehicles: true,
  photos: {
    orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
  },
} satisfies Prisma.ChargingStationInclude;

@Injectable()
export class ChargingStationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async applyOperator(
    userId: string,
    dto: CreateOperatorProfileDto,
    auditContext: RequestAuditContext = {},
  ) {
    const existing = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Operator profile already exists');
    }

    const created = await this.prisma.operatorProfile.create({
      data: {
        userId,
        businessName: dto.businessName,
        businessRegNumber: dto.businessRegNumber,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        country: dto.country,
        city: dto.city,
        address: dto.address,
        description: dto.description,
        status: OperatorStatus.PENDING,
        isVerified: false,
      },
    });

    await this.auditService.record({
      userId,
      action: 'operators:applied',
      entity: 'OperatorProfile',
      entityId: created.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        businessName: created.businessName,
      },
    });

    await this.notificationsService.sendToRoleNames(
      ['MARKETPLACE_ADMIN', 'SUPER_ADMIN'],
      {
        type: NotificationType.SYSTEM_ALERT,
        title: 'New charging operator application',
        body: `${created.businessName} applied to become a charging operator.`,
        metadata: { operatorId: created.id },
      },
    );

    return created;
  }

  async getOperatorProfileByUser(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Operator profile not found');
    return profile;
  }

  async updateOperatorProfileByUser(
    userId: string,
    dto: UpdateOperatorProfileDto,
    auditContext: RequestAuditContext = {},
  ) {
    const existing = await this.getOperatorProfileByUser(userId);
    const updated = await this.prisma.operatorProfile.update({
      where: { id: existing.id },
      data: {
        businessName: dto.businessName,
        businessRegNumber: dto.businessRegNumber,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email,
        country: dto.country,
        city: dto.city,
        address: dto.address,
        description: dto.description,
      },
    });

    await this.auditService.record({
      userId,
      action: 'operators:updated',
      entity: 'OperatorProfile',
      entityId: updated.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { email: auditContext.actorEmail, fields: Object.keys(dto) },
    });

    return updated;
  }

  async listMyStations(userId: string, filters: FilterStationsDto = {}) {
    const operator = await this.requireActiveOperator(userId);
    return this.listStationsBase({
      ...filters,
      operatorId: operator.id,
    });
  }

  async createStation(
    userId: string,
    dto: CreateStationDto,
    auditContext: RequestAuditContext = {},
  ) {
    const operator = await this.requireActiveOperator(userId);

    const slug = await resolveUniqueSlug(dto.name, async (candidate) => {
      const row = await this.prisma.chargingStation.findUnique({
        where: { slug: candidate },
      });
      return Boolean(row);
    });

    const created = await this.prisma.chargingStation.create({
      data: {
        operatorId: operator.id,
        name: dto.name,
        slug,
        description: dto.description,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        latitude: dto.latitude,
        longitude: dto.longitude,
        locationType: dto.locationType,
        isOpen24h: dto.isOpen24h ?? false,
        openingHours: dto.openingHours as Prisma.InputJsonValue | undefined,
        totalPorts: dto.totalPorts ?? 0,
        availablePorts: dto.availablePorts,
        hasParking: dto.hasParking ?? false,
        hasWifi: dto.hasWifi ?? false,
        hasRestroom: dto.hasRestroom ?? false,
        hasCCTV: dto.hasCCTV ?? false,
        hasRoofCover: dto.hasRoofCover ?? false,
        operationalStatus: dto.operationalStatus ?? 'OPERATIONAL',
        status: 'DRAFT',
      },
      include: stationInclude,
    });

    await this.auditService.record({
      userId,
      action: 'stations:created',
      entity: 'ChargingStation',
      entityId: created.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { email: auditContext.actorEmail, stationName: created.name },
    });

    return created;
  }

  async updateStationByOwner(
    userId: string,
    stationId: string,
    dto: UpdateStationDto,
    auditContext: RequestAuditContext = {},
  ) {
    const station = await this.getStationOwnedBy(userId, stationId);

    if (dto.name && dto.name !== station.name) {
      const slug = await resolveUniqueSlug(dto.name, async (candidate) => {
        const row = await this.prisma.chargingStation.findUnique({
          where: { slug: candidate },
        });
        return Boolean(row) && row?.id !== station.id;
      });
      dto = { ...dto, name: dto.name };
      await this.prisma.chargingStation.update({
        where: { id: station.id },
        data: { slug },
      });
    }

    const updated = await this.prisma.chargingStation.update({
      where: { id: station.id },
      data: {
        name: dto.name,
        description: dto.description,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        latitude: dto.latitude,
        longitude: dto.longitude,
        locationType: dto.locationType,
        isOpen24h: dto.isOpen24h,
        openingHours: dto.openingHours as Prisma.InputJsonValue | undefined,
        totalPorts: dto.totalPorts,
        availablePorts: dto.availablePorts,
        hasParking: dto.hasParking,
        hasWifi: dto.hasWifi,
        hasRestroom: dto.hasRestroom,
        hasCCTV: dto.hasCCTV,
        hasRoofCover: dto.hasRoofCover,
        operationalStatus: dto.operationalStatus,
      },
      include: stationInclude,
    });

    await this.auditService.record({
      userId,
      action: 'stations:updated',
      entity: 'ChargingStation',
      entityId: updated.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { email: auditContext.actorEmail, fields: Object.keys(dto) },
    });

    return updated;
  }

  async submitStationByOwner(
    userId: string,
    stationId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const station = (await this.getStationOwnedBy(userId, stationId, {
      ports: { where: { isActive: true }, select: { id: true } },
      photos: { select: { id: true } },
      operator: true,
    })) as Prisma.ChargingStationGetPayload<{
      include: {
        ports: { where: { isActive: true }; select: { id: true } };
        photos: { select: { id: true } };
        operator: true;
      };
    }>;

    if (!['DRAFT', 'REJECTED'].includes(station.status)) {
      throw new BadRequestException(
        'Only draft or rejected stations can be submitted',
      );
    }
    if (station.ports.length === 0) {
      throw new BadRequestException(
        'Add at least one active charging port before submitting',
      );
    }
    if (station.photos.length === 0) {
      throw new BadRequestException(
        'Add at least one station photo before submitting',
      );
    }
    if (station.latitude == null || station.longitude == null) {
      throw new BadRequestException(
        'Station latitude and longitude are required before submitting',
      );
    }

    const updated = await this.prisma.chargingStation.update({
      where: { id: station.id },
      data: {
        status: StationStatus.PENDING_REVIEW,
      },
      include: stationInclude,
    });

    await this.auditService.record({
      userId,
      action: 'stations:submitted',
      entity: 'ChargingStation',
      entityId: updated.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { email: auditContext.actorEmail, stationName: updated.name },
    });

    await this.notificationsService.sendToRoleNames(
      ['MARKETPLACE_ADMIN', 'SUPER_ADMIN'],
      {
        type: NotificationType.SYSTEM_ALERT,
        title: 'Charging station submitted',
        body: `${station.operator.businessName} submitted ${updated.name} for review.`,
        metadata: { stationId: updated.id },
      },
    );

    return updated;
  }

  async addPortByOwner(
    userId: string,
    stationId: string,
    dto: CreateChargingPortDto,
  ) {
    const station = await this.getStationOwnedBy(userId, stationId);
    await this.prisma.chargingPort.create({
      data: {
        stationId: station.id,
        portNumber: dto.portNumber,
        chargerType: dto.chargerType,
        speedCategory: dto.speedCategory,
        powerKw: dto.powerKw,
        voltage: dto.voltage,
        amperage: dto.amperage,
        currentType: dto.currentType,
        status: dto.status ?? PortStatus.AVAILABLE,
        isActive: dto.isActive ?? true,
      },
    });
    return this.refreshPortCounts(station.id);
  }

  async updatePortByOwner(
    userId: string,
    stationId: string,
    portId: string,
    dto: UpdateChargingPortDto,
  ) {
    const station = await this.getStationOwnedBy(userId, stationId);
    const port = await this.prisma.chargingPort.findFirst({
      where: { id: portId, stationId: station.id },
    });
    if (!port) throw new NotFoundException('Charging port not found');

    await this.prisma.chargingPort.update({
      where: { id: port.id },
      data: {
        portNumber: dto.portNumber,
        chargerType: dto.chargerType,
        speedCategory: dto.speedCategory,
        powerKw: dto.powerKw,
        voltage: dto.voltage,
        amperage: dto.amperage,
        currentType: dto.currentType,
        status: dto.status,
        isActive: dto.isActive,
      },
    });
    return this.refreshPortCounts(station.id);
  }

  async removePortByOwner(userId: string, stationId: string, portId: string) {
    const station = await this.getStationOwnedBy(userId, stationId);
    const deleted = await this.prisma.chargingPort.deleteMany({
      where: { id: portId, stationId: station.id },
    });
    if (!deleted.count) throw new NotFoundException('Charging port not found');
    return this.refreshPortCounts(station.id);
  }

  async setPricingByOwner(
    userId: string,
    stationId: string,
    dto: CreateStationPricingDto,
  ) {
    const station = await this.getStationOwnedBy(userId, stationId);
    if (dto.pricingModel !== 'FREE' && dto.rateAmount == null) {
      throw new BadRequestException('rateAmount is required for paid pricing');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.isActive ?? true) {
        await tx.stationPricing.updateMany({
          where: { stationId: station.id, isActive: true },
          data: { isActive: false },
        });
      }

      await tx.stationPricing.create({
        data: {
          stationId: station.id,
          pricingModel: dto.pricingModel,
          rateAmount: dto.rateAmount,
          currency: dto.currency ?? 'USD',
          notes: dto.notes,
          isActive: dto.isActive ?? true,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : new Date(),
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        },
      });
    });

    return this.findMyStationById(userId, station.id);
  }

  async addCompatibilityByOwner(
    userId: string,
    stationId: string,
    dto: CreateVehicleCompatibilityDto,
  ) {
    const station = await this.getStationOwnedBy(userId, stationId);
    await this.prisma.vehicleCompatibility.create({
      data: {
        stationId: station.id,
        vehicleCategory: dto.vehicleCategory,
        brand: dto.brand,
        model: dto.model,
        isVerified: dto.isVerified ?? false,
      },
    });
    return this.findMyStationById(userId, station.id);
  }

  async addPhotosByOwner(
    userId: string,
    stationId: string,
    photoUrls: string[],
  ) {
    const station = (await this.getStationOwnedBy(userId, stationId, {
      photos: { select: { id: true } },
    })) as Prisma.ChargingStationGetPayload<{
      include: { photos: { select: { id: true } } };
    }>;
    if (!photoUrls.length) {
      throw new BadRequestException('Provide at least one image');
    }

    await this.prisma.stationPhoto.createMany({
      data: photoUrls.map((url, index) => ({
        stationId: station.id,
        url,
        isPrimary: station.photos.length === 0 && index === 0,
        displayOrder: station.photos.length + index,
      })),
    });

    return this.findMyStationById(userId, station.id);
  }

  async findMyStationById(userId: string, stationId: string) {
    const station = await this.getStationOwnedBy(
      userId,
      stationId,
      stationInclude,
    );
    return this.sanitizeStation(station, false);
  }

  async browsePublicStations(filters: FilterStationsDto = {}) {
    return this.listStationsBase(filters, true);
  }

  async listCitiesWithActiveStations() {
    const rows = await this.prisma.chargingStation.findMany({
      where: {
        status: StationStatus.ACTIVE,
        operationalStatus: { not: StationOperationalStatus.OFFLINE },
      },
      select: { city: true, country: true },
      distinct: ['city', 'country'],
      orderBy: [{ country: 'asc' }, { city: 'asc' }],
    });
    return rows;
  }

  async findPublicStationBySlug(slug: string) {
    const station = await this.prisma.chargingStation.findFirst({
      where: {
        slug,
        status: StationStatus.ACTIVE,
        operationalStatus: { not: StationOperationalStatus.OFFLINE },
      },
      include: stationInclude,
    });
    if (!station) throw new NotFoundException('Charging station not found');
    return this.sanitizeStation(station, true);
  }

  async findNearbyPublicStations(lat: number, lng: number, radiusKm = 10) {
    const rows = await this.prisma.$queryRaw<
      { id: string; distance_km: number }[]
    >(Prisma.sql`
      SELECT id,
             (6371 * acos(
               cos(radians(${lat})) * cos(radians(latitude)) *
               cos(radians(longitude) - radians(${lng})) +
               sin(radians(${lat})) * sin(radians(latitude))
             )) AS distance_km
      FROM charging_stations
      WHERE status = 'ACTIVE'
        AND operational_status <> 'OFFLINE'
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      HAVING (6371 * acos(
               cos(radians(${lat})) * cos(radians(latitude)) *
               cos(radians(longitude) - radians(${lng})) +
               sin(radians(${lat})) * sin(radians(latitude))
             )) <= ${radiusKm}
      ORDER BY distance_km ASC
      LIMIT 200
    `);

    if (!rows.length) return [];
    const stations = await this.prisma.chargingStation.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      include: stationInclude,
    });
    const map = new Map(stations.map((s) => [s.id, s]));
    return rows
      .map((r) => {
        const station = map.get(r.id);
        if (!station) return null;
        return {
          ...this.sanitizeStation(station, true),
          distanceKm: r.distance_km,
        };
      })
      .filter(Boolean);
  }

  async adminListOperators(filters: FilterStationsDto = {}) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;
    const where: Prisma.OperatorProfileWhereInput = {};

    if (
      filters.status &&
      ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'].includes(filters.status)
    ) {
      where.status = filters.status as OperatorStatus;
    }
    if (filters.q) {
      where.OR = [
        { businessName: { contains: filters.q, mode: 'insensitive' } },
        { city: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.operatorProfile.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          stations: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.operatorProfile.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async adminApproveOperator(
    operatorId: string,
    adminId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const operator = await this.getOperatorOrThrow(operatorId);
    if (operator.status === OperatorStatus.ACTIVE) {
      throw new BadRequestException('Operator is already active');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.operatorProfile.update({
        where: { id: operator.id },
        data: {
          status: OperatorStatus.ACTIVE,
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      const role = await tx.role.findUnique({
        where: { name: 'CHARGING_OPERATOR' },
      });
      if (!role) {
        throw new NotFoundException(
          'Role CHARGING_OPERATOR does not exist. Seed roles first.',
        );
      }

      const existingRole = await tx.userRole.findFirst({
        where: { userId: operator.userId, roleId: role.id },
      });
      if (!existingRole) {
        await tx.userRole.create({
          data: { userId: operator.userId, roleId: role.id },
        });
      }
      return row;
    });

    await this.auditService.record({
      userId: adminId,
      action: 'operators:approved',
      entity: 'OperatorProfile',
      entityId: operator.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        businessName: operator.businessName,
      },
    });

    await this.notificationsService.send({
      userId: operator.userId,
      type: NotificationType.OPERATOR_APPLICATION_APPROVED,
      title: 'Operator application approved',
      body: 'Your charging operator application is approved. You can now manage stations.',
      metadata: { operatorId: operator.id },
    });

    return updated;
  }

  async adminRejectOperator(
    operatorId: string,
    adminId: string,
    dto: StationReviewActionDto = {},
    auditContext: RequestAuditContext = {},
  ) {
    const operator = await this.getOperatorOrThrow(operatorId);
    const updated = await this.prisma.operatorProfile.update({
      where: { id: operator.id },
      data: {
        status: OperatorStatus.REJECTED,
        isVerified: false,
        adminNotes: dto.reason,
      },
    });

    await this.auditService.record({
      userId: adminId,
      action: 'operators:rejected',
      entity: 'OperatorProfile',
      entityId: operator.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { email: auditContext.actorEmail, reason: dto.reason },
    });

    await this.notificationsService.send({
      userId: operator.userId,
      type: NotificationType.OPERATOR_APPLICATION_REJECTED,
      title: 'Operator application rejected',
      body:
        dto.reason ?? 'Your charging operator application was not approved.',
      metadata: { operatorId: operator.id },
    });

    return updated;
  }

  async adminListStations(filters: FilterStationsDto = {}) {
    return this.listStationsBase(filters);
  }

  async adminApproveStation(
    stationId: string,
    adminId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const station = await this.getStationOrThrow(stationId);
    if (!canStationTransition(station.status, StationStatus.ACTIVE)) {
      throw new BadRequestException(
        `Cannot approve station from status ${station.status}`,
      );
    }

    const updated = await this.prisma.chargingStation.update({
      where: { id: station.id },
      data: {
        status: StationStatus.ACTIVE,
        adminNotes: null,
        publishedAt: station.publishedAt ?? new Date(),
      },
      include: stationInclude,
    });

    await this.auditService.record({
      userId: adminId,
      action: 'stations:approved',
      entity: 'ChargingStation',
      entityId: station.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { email: auditContext.actorEmail, stationName: station.name },
    });

    await this.notificationsService.send({
      userId: station.operator.userId,
      type: NotificationType.STATION_APPROVED,
      title: 'Charging station approved',
      body: `${station.name} has been approved and is now visible publicly.`,
      metadata: { stationId: station.id },
    });

    return this.sanitizeStation(updated, false);
  }

  async adminRejectStation(
    stationId: string,
    adminId: string,
    dto: StationReviewActionDto = {},
    auditContext: RequestAuditContext = {},
  ) {
    const station = await this.getStationOrThrow(stationId);
    if (!canStationTransition(station.status, StationStatus.REJECTED)) {
      throw new BadRequestException(
        `Cannot reject station from status ${station.status}`,
      );
    }

    const updated = await this.prisma.chargingStation.update({
      where: { id: station.id },
      data: {
        status: StationStatus.REJECTED,
        adminNotes: dto.reason,
      },
      include: stationInclude,
    });

    await this.auditService.record({
      userId: adminId,
      action: 'stations:rejected',
      entity: 'ChargingStation',
      entityId: station.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { email: auditContext.actorEmail, reason: dto.reason },
    });

    await this.notificationsService.send({
      userId: station.operator.userId,
      type: NotificationType.STATION_REJECTED,
      title: 'Charging station rejected',
      body:
        dto.reason ??
        `${station.name} was rejected. Please update and resubmit.`,
      metadata: { stationId: station.id },
    });

    return this.sanitizeStation(updated, false);
  }

  async adminSuspendStation(
    stationId: string,
    adminId: string,
    dto: StationReviewActionDto = {},
    auditContext: RequestAuditContext = {},
  ) {
    const station = await this.getStationOrThrow(stationId);
    if (!canStationTransition(station.status, StationStatus.SUSPENDED)) {
      throw new BadRequestException(
        `Cannot suspend station from status ${station.status}`,
      );
    }

    const updated = await this.prisma.chargingStation.update({
      where: { id: station.id },
      data: {
        status: StationStatus.SUSPENDED,
        adminNotes: dto.reason,
      },
      include: stationInclude,
    });

    await this.auditService.record({
      userId: adminId,
      action: 'stations:suspended',
      entity: 'ChargingStation',
      entityId: station.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: { email: auditContext.actorEmail, reason: dto.reason },
    });

    await this.notificationsService.send({
      userId: station.operator.userId,
      type: NotificationType.STATION_SUSPENDED,
      title: 'Charging station suspended',
      body:
        dto.reason ?? `${station.name} has been suspended by the admin team.`,
      metadata: { stationId: station.id },
    });

    return this.sanitizeStation(updated, false);
  }

  private async listStationsBase(
    filters: FilterStationsDto = {},
    publicOnly = false,
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 24;
    const skip = (page - 1) * limit;
    const where = this.buildStationWhere(filters, publicOnly);

    const [items, total] = await Promise.all([
      this.prisma.chargingStation.findMany({
        where,
        include: stationInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.chargingStation.count({ where }),
    ]);

    return {
      items: items.map((row) => this.sanitizeStation(row, publicOnly)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  private buildStationWhere(
    filters: FilterStationsDto,
    publicOnly: boolean,
  ): Prisma.ChargingStationWhereInput {
    const where: Prisma.ChargingStationWhereInput = {};

    if (publicOnly) {
      where.status = StationStatus.ACTIVE;
      where.operationalStatus = { not: StationOperationalStatus.OFFLINE };
    } else if (filters.status) {
      where.status = filters.status;
    }

    if (filters.operatorId) where.operatorId = filters.operatorId;
    if (filters.country) where.country = filters.country;
    if (filters.city)
      where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters.locationType) where.locationType = filters.locationType;
    if (filters.operationalStatus)
      where.operationalStatus = filters.operationalStatus;
    if (filters.isOpen24h !== undefined) where.isOpen24h = filters.isOpen24h;
    if (filters.hasParking !== undefined) where.hasParking = filters.hasParking;

    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { city: { contains: filters.q, mode: 'insensitive' } },
        { address: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    if (filters.chargerType || filters.speedCategory || filters.powerKwMin) {
      where.ports = {
        some: {
          isActive: true,
          chargerType: filters.chargerType,
          speedCategory: filters.speedCategory,
          powerKw: filters.powerKwMin ? { gte: filters.powerKwMin } : undefined,
        },
      };
    }

    if (filters.vehicleCategory || filters.brand) {
      where.compatibleVehicles = {
        some: {
          vehicleCategory: filters.vehicleCategory,
          brand: filters.brand
            ? { contains: filters.brand, mode: 'insensitive' }
            : undefined,
        },
      };
    }

    if (filters.pricingModel) {
      where.pricing = {
        some: {
          isActive: true,
          pricingModel: filters.pricingModel,
        },
      };
    }

    return where;
  }

  private sanitizeStation<T extends { adminNotes?: string | null }>(
    station: T,
    publicView: boolean,
  ) {
    if (!publicView) return station;
    const { adminNotes: _adminNotes, ...rest } = station;
    return rest;
  }

  private async requireActiveOperator(userId: string) {
    const profile = await this.prisma.operatorProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Operator profile not found');
    if (profile.status !== OperatorStatus.ACTIVE || !profile.isVerified) {
      throw new ForbiddenException(
        'Operator must be approved before managing stations',
      );
    }
    return profile;
  }

  private async getOperatorOrThrow(id: string) {
    const operator = await this.prisma.operatorProfile.findUnique({
      where: { id },
    });
    if (!operator) throw new NotFoundException('Operator profile not found');
    return operator;
  }

  private async getStationOrThrow(id: string) {
    const station = await this.prisma.chargingStation.findUnique({
      where: { id },
      include: {
        operator: true,
      },
    });
    if (!station) throw new NotFoundException('Charging station not found');
    return station;
  }

  private async getStationOwnedBy(
    userId: string,
    stationId: string,
    include?: Prisma.ChargingStationInclude,
  ) {
    const operator = await this.requireActiveOperator(userId);
    const station = await this.prisma.chargingStation.findFirst({
      where: {
        id: stationId,
        operatorId: operator.id,
      },
      include,
    });
    if (!station) {
      throw new NotFoundException('Charging station not found');
    }
    return station;
  }

  private async refreshPortCounts(stationId: string) {
    const [total, available] = await Promise.all([
      this.prisma.chargingPort.count({
        where: { stationId, isActive: true },
      }),
      this.prisma.chargingPort.count({
        where: {
          stationId,
          isActive: true,
          status: PortStatus.AVAILABLE,
        },
      }),
    ]);

    await this.prisma.chargingStation.update({
      where: { id: stationId },
      data: {
        totalPorts: total,
        availablePorts: available,
      },
    });
    return this.prisma.chargingStation.findUnique({
      where: { id: stationId },
      include: stationInclude,
    });
  }
}
