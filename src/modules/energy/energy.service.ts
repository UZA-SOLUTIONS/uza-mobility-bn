import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { resolveUniqueSlug } from '../../common/utils/slug.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChargingProductDto } from './dto/create-charging-product.dto';
import { CreateEnergyRequestDto } from './dto/create-energy-request.dto';
import { UpdateChargingProductDto } from './dto/update-charging-product.dto';
import { UpdateEnergyRequestStatusDto } from './dto/update-energy-request-status.dto';
import { ENERGY_REQUEST_STATUSES } from './energy.constants';

@Injectable()
export class EnergyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async browseProducts() {
    return this.prisma.chargingProduct.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { photos: true },
    });
  }

  async findProductById(id: string) {
    const product = await this.prisma.chargingProduct.findFirst({
      where: { id, isActive: true },
      include: { photos: true },
    });

    if (!product) {
      throw new NotFoundException('Charging product not found');
    }

    return product;
  }

  async createProduct(dto: CreateChargingProductDto) {
    const slug = await resolveUniqueSlug(dto.name, (candidate) =>
      this.prisma.chargingProduct
        .findUnique({ where: { slug: candidate } })
        .then((row) => row !== null),
    );

    return this.prisma.chargingProduct.create({
      data: {
        name: dto.name,
        slug,
        productType: dto.productType,
        brand: dto.brand,
        powerKw: dto.powerKw,
        voltage: dto.voltage,
        connectorTypes: dto.connectorTypes ?? [],
        solarIncluded: dto.solarIncluded ?? false,
        priceUsd: dto.priceUsd,
        description: dto.description,
        isActive: true,
        photos: dto.photoUrls?.length
          ? {
              create: dto.photoUrls.map((url, index) => ({
                url,
                isPrimary: index === 0,
              })),
            }
          : undefined,
      },
      include: { photos: true },
    });
  }

  async updateProduct(id: string, dto: UpdateChargingProductDto) {
    await this.getProductOrThrow(id);

    return this.prisma.chargingProduct.update({
      where: { id },
      data: {
        name: dto.name,
        productType: dto.productType,
        brand: dto.brand,
        powerKw: dto.powerKw,
        voltage: dto.voltage,
        connectorTypes: dto.connectorTypes,
        solarIncluded: dto.solarIncluded,
        priceUsd: dto.priceUsd,
        description: dto.description,
      },
      include: { photos: true },
    });
  }

  async submitRequest(dto: CreateEnergyRequestDto) {
    if (dto.chargingProductId) {
      await this.getProductOrThrow(dto.chargingProductId);
    }

    const request = await this.prisma.energyRequest.create({
      data: {
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        clientType: dto.clientType,
        location: dto.location,
        city: dto.city,
        numberOfEvs: dto.numberOfEvs,
        chargerTypeNeeded: dto.chargerTypeNeeded,
        solarSupportNeeded: dto.solarSupportNeeded ?? false,
        fleetUse: dto.fleetUse ?? false,
        siteVisitRequested: dto.siteVisitRequested ?? false,
        chargingProductId: dto.chargingProductId,
        notes: dto.notes,
        status: 'SUBMITTED',
      },
    });

    await this.notificationsService.sendToRoleNames(
      ['FLEET_ADMIN', 'SUPER_ADMIN'],
      {
        type: NotificationType.SYSTEM_ALERT,
        title: 'New energy quote request',
        body: `${dto.contactName} submitted an energy/charging request.`,
        metadata: { energyRequestId: request.id },
      },
    );

    return request;
  }

  async adminListRequests(filters: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.EnergyRequestWhereInput = {};
    if (filters.status) {
      where.status = filters.status;
    }

    const [rows, total] = await Promise.all([
      this.prisma.energyRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { chargingProduct: { select: { name: true, slug: true } } },
      }),
      this.prisma.energyRequest.count({ where }),
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

  async updateRequestStatus(id: string, dto: UpdateEnergyRequestStatusDto) {
    if (!ENERGY_REQUEST_STATUSES.includes(dto.status as never)) {
      throw new BadRequestException('Invalid energy request status');
    }

    await this.getRequestOrThrow(id);

    return this.prisma.energyRequest.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  private async getProductOrThrow(id: string) {
    const product = await this.prisma.chargingProduct.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Charging product not found');
    }

    return product;
  }

  private async getRequestOrThrow(id: string) {
    const request = await this.prisma.energyRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Energy request not found');
    }

    return request;
  }
}
