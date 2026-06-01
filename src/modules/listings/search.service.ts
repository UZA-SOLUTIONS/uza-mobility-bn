import { Injectable } from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import {
  PUBLIC_CURATED_STATUSES,
  PUBLIC_MARKETPLACE_STATUSES,
} from './listings.constants';
import { FilterListingsDto, SortOption } from './dto/filter-listings.dto';

@Injectable()
export class SearchService {
  buildWhereClause(
    filters: FilterListingsDto,
    options?: {
      statuses?: ListingStatus[];
      includeDeleted?: boolean;
    },
  ): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = {
      status: {
        in: options?.statuses ?? PUBLIC_MARKETPLACE_STATUSES,
      },
    };

    if (!options?.includeDeleted) {
      where.deletedAt = null;
    }

    if (filters.q) {
      where.OR = [
        { listingTitle: { contains: filters.q, mode: 'insensitive' } },
        { brand: { contains: filters.q, mode: 'insensitive' } },
        { model: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    if (filters.category) {
      where.category = { slug: filters.category };
    }

    if (filters.subcategories?.length) {
      where.subcategory = { slug: { in: filters.subcategories } };
    } else if (filters.subcategory) {
      where.subcategory = { slug: filters.subcategory };
    }

    if (filters.bodyType) {
      where.bodyType = filters.bodyType;
    }

    if (filters.drivetrain) {
      where.drivetrain = filters.drivetrain;
    }

    if (filters.color) {
      where.color = { equals: filters.color, mode: 'insensitive' };
    }

    if (filters.brand) {
      where.brand = { equals: filters.brand, mode: 'insensitive' };
    }

    if (filters.model) {
      where.model = { contains: filters.model, mode: 'insensitive' };
    }

    if (filters.sellerType) {
      where.sellerType = filters.sellerType;
    }

    if (filters.condition) {
      where.condition = filters.condition;
    }

    if (filters.isNew !== undefined) {
      where.isNew = filters.isNew;
    }

    if (filters.country) {
      where.country = filters.country;
    }

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters.yearMin !== undefined || filters.yearMax !== undefined) {
      where.manufacturingYear = {
        gte: filters.yearMin,
        lte: filters.yearMax,
      };
    }

    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      where.listingPricing = {
        is: {
          finalPriceUsd: {
            gte: filters.priceMin,
            lte: filters.priceMax,
          },
        },
      };
    }

    if (filters.mileageMin !== undefined || filters.mileageMax !== undefined) {
      where.mileageKm = {
        gte: filters.mileageMin,
        lte: filters.mileageMax,
      };
    }

    const evSpecFilter: Prisma.EvSpecWhereInput = {};

    if (filters.batteryCapacityKwh !== undefined) {
      evSpecFilter.batteryCapacityKwh = filters.batteryCapacityKwh;
    } else if (filters.batteryCapacityMin !== undefined) {
      evSpecFilter.batteryCapacityKwh = { gte: filters.batteryCapacityMin };
    }
    if (filters.batteryHealthMin !== undefined) {
      evSpecFilter.batteryHealthPercent = { gte: filters.batteryHealthMin };
    }
    if (filters.rangeMin !== undefined) {
      evSpecFilter.rangeKm = { gte: filters.rangeMin };
    }
    if (filters.fastCharging !== undefined) {
      evSpecFilter.fastChargingSupported = filters.fastCharging;
    }
    if (filters.chargingType) {
      evSpecFilter.chargingType = {
        equals: filters.chargingType,
        mode: 'insensitive',
      };
    }

    if (Object.keys(evSpecFilter).length > 0) {
      where.evSpecs = { is: evSpecFilter };
    }

    if (filters.verificationLevel) {
      where.verificationLevel = filters.verificationLevel;
    }

    if (filters.deliveryDaysMax !== undefined) {
      where.deliveryEstimateDays = { lte: filters.deliveryDaysMax };
    }

    if (filters.useCase) {
      where.useCaseTags = {
        some: { useCase: filters.useCase },
      };
    }

    return where;
  }

  buildOrderByClause(
    sort?: SortOption,
  ):
    | Prisma.ListingOrderByWithRelationInput
    | Prisma.ListingOrderByWithRelationInput[] {
    const map: Record<SortOption, Prisma.ListingOrderByWithRelationInput> = {
      [SortOption.NEWEST]: { createdAt: 'desc' },
      [SortOption.PRICE_LOW]: { listingPricing: { finalPriceUsd: 'asc' } },
      [SortOption.PRICE_HIGH]: { listingPricing: { finalPriceUsd: 'desc' } },
      [SortOption.LOWEST_KM]: { mileageKm: 'asc' },
      [SortOption.BATTERY_HIGH]: {
        evSpecs: { batteryHealthPercent: 'desc' },
      },
      [SortOption.RANGE_HIGH]: { evSpecs: { rangeKm: 'desc' } },
      [SortOption.FAST_DELIVER]: { deliveryEstimateDays: 'asc' },
      [SortOption.MOST_VIEWED]: { viewCount: 'desc' },
      [SortOption.FEATURED]: { isFeatured: 'desc' },
      [SortOption.BEST_SCORE]: { verificationLevel: 'desc' },
    };

    return map[sort ?? SortOption.NEWEST];
  }

  buildCollectionWhere(
    base: Prisma.ListingWhereInput,
    extra: Prisma.ListingWhereInput,
  ): Prisma.ListingWhereInput {
    return { AND: [base, extra] };
  }

  buildCuratedBrowseWhere(
    filters: FilterListingsDto,
  ): Prisma.ListingWhereInput {
    return this.buildWhereClause(filters, {
      statuses: PUBLIC_CURATED_STATUSES,
    });
  }
}
