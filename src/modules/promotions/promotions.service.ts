import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingStatus,
  Prisma,
  Promotion,
  PromotionType,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AttachPromotionDto } from './dto/attach-promotion.dto';
import type {
  CreatePromotionPayload,
  UpdatePromotionPayload,
} from './dto/promotion-write.types';
import {
  pickBestDiscountPromotion,
  type PromotionPriceDisplay,
  toPromotionPriceDisplay,
} from './promotion-display.util';

const activePromotionWhere = (
  now = new Date(),
): Prisma.PromotionWhereInput => ({
  isActive: true,
  startDate: { lte: now },
  endDate: { gte: now },
});

const discountPromotionWhere: Prisma.PromotionWhereInput = {
  OR: [
    { discountPercent: { not: null } },
    { discountAmountUsd: { not: null } },
  ],
};

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findActivePublic() {
    return this.prisma.promotion.findMany({
      where: activePromotionWhere(),
      orderBy: { startDate: 'desc' },
    });
  }

  async findActiveBanners() {
    return this.prisma.promotion.findMany({
      where: {
        ...activePromotionWhere(),
        type: PromotionType.HOMEPAGE_BANNER,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findAllAdmin() {
    return this.prisma.promotion.findMany({
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      include: { _count: { select: { listings: true } } },
    });
  }

  async create(
    dto: CreatePromotionPayload,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    this.assertValidDateRange(dto.startDate, dto.endDate);

    const promotion = await this.prisma.promotion.create({
      data: {
        name: dto.name,
        type: dto.type,
        sponsorName: dto.sponsorName,
        discountAmountUsd: dto.discountAmountUsd,
        discountPercent: dto.discountPercent,
        bannerImageUrl: dto.bannerImageUrl,
        bannerPlacement: dto.bannerPlacement,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        clickUrl: dto.clickUrl,
        notes: dto.notes,
      },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'promotions:created',
      entity: 'Promotion',
      metadata: { promotionId: promotion.id, name: promotion.name },
      ...auditContext,
    });

    return promotion;
  }

  async update(
    id: string,
    dto: UpdatePromotionPayload,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const existing = await this.getPromotionOrThrow(id);

    if (dto.startDate || dto.endDate) {
      this.assertValidDateRange(
        dto.startDate ?? existing.startDate.toISOString(),
        dto.endDate ?? existing.endDate.toISOString(),
      );
    }

    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        sponsorName: dto.sponsorName,
        discountAmountUsd: dto.discountAmountUsd,
        discountPercent: dto.discountPercent,
        bannerImageUrl: dto.bannerImageUrl,
        bannerPlacement: dto.bannerPlacement,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        clickUrl: dto.clickUrl,
        notes: dto.notes,
      },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'promotions:updated',
      entity: 'Promotion',
      metadata: { promotionId: id },
      ...auditContext,
    });

    return promotion;
  }

  async deactivate(
    id: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    await this.getPromotionOrThrow(id);

    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'promotions:deactivated',
      entity: 'Promotion',
      metadata: { promotionId: id },
      ...auditContext,
    });

    return promotion;
  }

  async attachListings(
    promotionId: string,
    dto: AttachPromotionDto,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    await this.getPromotionOrThrow(promotionId);

    const listings = await this.prisma.listing.findMany({
      where: { id: { in: dto.listingIds }, deletedAt: null },
      select: { id: true },
    });

    if (listings.length !== dto.listingIds.length) {
      throw new BadRequestException('One or more listings were not found');
    }

    await this.prisma.listingPromotion.createMany({
      data: dto.listingIds.map((listingId) => ({
        listingId,
        promotionId,
      })),
      skipDuplicates: true,
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'promotions:listings-attached',
      entity: 'Promotion',
      metadata: { promotionId, listingIds: dto.listingIds },
      ...auditContext,
    });

    return this.getPromotionOrThrow(promotionId, true);
  }

  async detachListing(
    promotionId: string,
    listingId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    await this.getPromotionOrThrow(promotionId);

    await this.prisma.listingPromotion.deleteMany({
      where: { promotionId, listingId },
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'promotions:listing-detached',
      entity: 'Promotion',
      metadata: { promotionId, listingId },
      ...auditContext,
    });

    return { promotionId, listingId, detached: true };
  }

  async deactivateExpired(): Promise<number> {
    const result = await this.prisma.promotion.updateMany({
      where: {
        isActive: true,
        endDate: { lt: new Date() },
      },
      data: { isActive: false },
    });

    return result.count;
  }

  async getDiscountPromotionsForListing(
    listingId: string,
  ): Promise<Promotion[]> {
    return this.prisma.promotion.findMany({
      where: {
        ...activePromotionWhere(),
        ...discountPromotionWhere,
        listings: { some: { listingId } },
      },
    });
  }

  async getBestDisplayForListing(
    listingId: string,
    basePriceUsd: number,
  ): Promise<PromotionPriceDisplay | null> {
    const promotions = await this.getDiscountPromotionsForListing(listingId);
    const best = pickBestDiscountPromotion(basePriceUsd, promotions);
    if (!best) return null;
    return toPromotionPriceDisplay(basePriceUsd, best);
  }

  async getBestDisplayByListingIds(
    listingIds: string[],
  ): Promise<Map<string, PromotionPriceDisplay>> {
    if (listingIds.length === 0) return new Map();

    const now = new Date();
    const links = await this.prisma.listingPromotion.findMany({
      where: {
        listingId: { in: listingIds },
        promotion: {
          ...activePromotionWhere(now),
          ...discountPromotionWhere,
        },
      },
      include: {
        promotion: true,
        listing: { include: { listingPricing: true } },
      },
    });

    const byListing = new Map<string, Promotion[]>();
    for (const link of links) {
      const list = byListing.get(link.listingId) ?? [];
      list.push(link.promotion);
      byListing.set(link.listingId, list);
    }

    const result = new Map<string, PromotionPriceDisplay>();
    for (const [listingId, promotions] of byListing) {
      const pricing = links.find((l) => l.listingId === listingId)?.listing
        .listingPricing;
      const base = pricing?.finalPriceUsd;
      if (base == null) continue;

      const best = pickBestDiscountPromotion(base, promotions);
      if (best) {
        result.set(listingId, toPromotionPriceDisplay(base, best));
      }
    }

    return result;
  }

  async findRecentlyReducedListingIds(limit = 12): Promise<string[]> {
    const now = new Date();
    const rows = await this.prisma.listingPromotion.findMany({
      where: {
        promotion: {
          ...activePromotionWhere(now),
          ...discountPromotionWhere,
        },
        listing: {
          status: ListingStatus.PUBLISHED,
          deletedAt: null,
        },
      },
      select: { listingId: true },
      distinct: ['listingId'],
      take: limit * 3,
    });

    return rows.map((r) => r.listingId).slice(0, limit);
  }

  private async getPromotionOrThrow(id: string, withListings = false) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: withListings
        ? {
            listings: {
              include: {
                listing: {
                  select: {
                    id: true,
                    listingTitle: true,
                    slug: true,
                    status: true,
                  },
                },
              },
            },
            _count: { select: { listings: true } },
          }
        : { _count: { select: { listings: true } } },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    return promotion;
  }

  private assertValidDateRange(start: string, end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }
  }
}
