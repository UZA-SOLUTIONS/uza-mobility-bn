import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterImpactDto } from './dto/filter-impact.dto';
import {
  CO2_KG_PER_TREE_YEAR,
  DEFAULT_EMISSIONS_FACTORS,
  EMISSIONS_FACTORS,
} from './sustainability.constants';

export interface ImpactCounters {
  evsDelivered: number;
  co2AvoidedKg: number;
  fuelSavedLitres: number;
  greenKmEnabled: number;
  treesEquivalent: number;
  methodologyNote: string;
}

@Injectable()
export class SustainabilityService {
  private readonly logger = new Logger(SustainabilityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordDelivery(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        listing: { include: { category: true } },
        user: { include: { buyerProfile: true } },
      },
    });

    if (!order?.listing) {
      return;
    }

    const categoryType = order.listing.category.type;
    const factors =
      EMISSIONS_FACTORS[categoryType] ?? DEFAULT_EMISSIONS_FACTORS;

    const annualKm = factors.annualKmEstimate;
    const co2Avoided = annualKm * factors.co2PerKmKg;
    const fuelSaved = annualKm * factors.fuelSavedPerKmL;

    await this.prisma.sustainabilityMetric.create({
      data: {
        listingId: order.listingId,
        orderId: order.id,
        vehicleType: categoryType,
        buyerType: order.user.buyerProfile?.buyerType,
        country: order.deliveryCountry ?? order.listing.country,
        estimatedCo2AvoidedKg: co2Avoided,
        estimatedFuelSavedL: fuelSaved,
        greenKmSupported: annualKm,
      },
    });

    this.logger.log(
      `Sustainability metric recorded for order ${order.orderNumber}`,
    );
  }

  async getPublicImpactCounters(): Promise<ImpactCounters> {
    const metrics = await this.prisma.sustainabilityMetric.aggregate({
      _sum: {
        estimatedCo2AvoidedKg: true,
        estimatedFuelSavedL: true,
        greenKmSupported: true,
      },
      _count: { id: true },
    });

    const co2 = metrics._sum.estimatedCo2AvoidedKg ?? 0;

    return {
      evsDelivered: metrics._count.id,
      co2AvoidedKg: co2,
      fuelSavedLitres: metrics._sum.estimatedFuelSavedL ?? 0,
      greenKmEnabled: metrics._sum.greenKmSupported ?? 0,
      treesEquivalent: Math.floor(co2 / CO2_KG_PER_TREE_YEAR),
      methodologyNote:
        'Estimates use category-based annual km assumptions and ICE comparison factors. Trees equivalent uses ~21 kg CO2 per tree per year.',
    };
  }

  async getAdminOverview(filters: FilterImpactDto) {
    const where = this.buildWhere(filters);

    const [aggregate, recent] = await Promise.all([
      this.prisma.sustainabilityMetric.aggregate({
        where,
        _sum: {
          estimatedCo2AvoidedKg: true,
          estimatedFuelSavedL: true,
          greenKmSupported: true,
        },
        _count: { id: true },
      }),
      this.prisma.sustainabilityMetric.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        take: 50,
        include: {
          listing: {
            select: {
              id: true,
              listingTitle: true,
              slug: true,
              brand: true,
              model: true,
            },
          },
        },
      }),
    ]);

    const co2 = aggregate._sum.estimatedCo2AvoidedKg ?? 0;

    return {
      summary: {
        records: aggregate._count.id,
        co2AvoidedKg: co2,
        fuelSavedLitres: aggregate._sum.estimatedFuelSavedL ?? 0,
        greenKmEnabled: aggregate._sum.greenKmSupported ?? 0,
        treesEquivalent: Math.floor(co2 / CO2_KG_PER_TREE_YEAR),
      },
      recent,
    };
  }

  async breakdownByBuyerType(filters: FilterImpactDto) {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.sustainabilityMetric.groupBy({
      by: ['buyerType'],
      where,
      _sum: {
        estimatedCo2AvoidedKg: true,
        estimatedFuelSavedL: true,
        greenKmSupported: true,
      },
      _count: { id: true },
    });

    return rows.map((row) => ({
      buyerType: row.buyerType,
      records: row._count.id,
      co2AvoidedKg: row._sum.estimatedCo2AvoidedKg ?? 0,
      fuelSavedLitres: row._sum.estimatedFuelSavedL ?? 0,
      greenKmEnabled: row._sum.greenKmSupported ?? 0,
    }));
  }

  async breakdownByCountry(filters: FilterImpactDto) {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.sustainabilityMetric.groupBy({
      by: ['country'],
      where,
      _sum: {
        estimatedCo2AvoidedKg: true,
        estimatedFuelSavedL: true,
        greenKmSupported: true,
      },
      _count: { id: true },
    });

    return rows.map((row) => ({
      country: row.country,
      records: row._count.id,
      co2AvoidedKg: row._sum.estimatedCo2AvoidedKg ?? 0,
      fuelSavedLitres: row._sum.estimatedFuelSavedL ?? 0,
      greenKmEnabled: row._sum.greenKmSupported ?? 0,
    }));
  }

  async breakdownByVehicleType(filters: FilterImpactDto) {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.sustainabilityMetric.groupBy({
      by: ['vehicleType'],
      where,
      _sum: {
        estimatedCo2AvoidedKg: true,
        estimatedFuelSavedL: true,
        greenKmSupported: true,
      },
      _count: { id: true },
    });

    return rows.map((row) => ({
      vehicleType: row.vehicleType,
      records: row._count.id,
      co2AvoidedKg: row._sum.estimatedCo2AvoidedKg ?? 0,
      fuelSavedLitres: row._sum.estimatedFuelSavedL ?? 0,
      greenKmEnabled: row._sum.greenKmSupported ?? 0,
    }));
  }

  async reportByFleetClient(clientName: string, filters: FilterImpactDto) {
    // getAdminOverview builds the same filter from these inputs, so scoping happens
    // there. This used to build a `where` and discard it, which read as if the scoping
    // had been forgotten.
    return this.getAdminOverview({ ...filters, fleetClientName: clientName });
  }

  private buildWhere(
    filters: FilterImpactDto,
  ): Prisma.SustainabilityMetricWhereInput {
    const where: Prisma.SustainabilityMetricWhereInput = {};

    if (filters.country) {
      where.country = filters.country;
    }
    if (filters.buyerType) {
      where.buyerType = filters.buyerType;
    }
    if (filters.vehicleType) {
      where.vehicleType = filters.vehicleType;
    }
    if (filters.fleetClientName) {
      where.fleetClientName = filters.fleetClientName;
    }
    if (filters.from || filters.to) {
      where.recordedAt = {};
      if (filters.from) {
        where.recordedAt.gte = new Date(filters.from);
      }
      if (filters.to) {
        where.recordedAt.lte = new Date(filters.to);
      }
    }

    return where;
  }
}
