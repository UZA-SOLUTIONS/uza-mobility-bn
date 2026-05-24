import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingStatus,
  NotificationType,
  Prisma,
  SellerType,
} from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { resolveUniqueSlug } from '../../common/utils/slug.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AddListingPhotosDto } from './dto/add-listing-photos.dto';
import { AdminFilterListingsDto } from './dto/admin-filter-listings.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { FilterListingsDto } from './dto/filter-listings.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { AdminCreateListingDto } from './dto/admin-create-listing.dto';
import { canTransition } from './listing-transitions';
import {
  toAdminListing,
  toPublicListing,
  toSellerListing,
} from './listing.mapper';
import {
  ADMIN_ONLY_SELLER_TYPES,
  PUBLIC_MARKETPLACE_STATUSES,
  adminListingInclude,
  publicListingInclude,
} from './listings.constants';
import { NotificationsService } from '../notifications/notifications.service';
import type { NotificationMetadata } from '../notifications/notifications.types';
import { PricingService } from '../pricing/pricing.service';
import { SellersService } from '../sellers/sellers.service';
import {
  assertListingPricingInput,
  breakdownToListingPricingCreate,
  deliveryDaysFromBreakdown,
  mergeListingPricingInput,
  toPricingInput,
} from './listing-pricing.util';
import type { CreateListingPricingDto } from './dto/create-listing-pricing.dto';
import { PromotionsService } from '../promotions/promotions.service';
import { SearchService } from './search.service';

type ListingSellerNotifyTarget = {
  listingTitle: string;
  slug: string;
  seller: { userId: string };
};

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly searchService: SearchService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly sellersService: SellersService,
    private readonly pricingService: PricingService,
    private readonly promotionsService: PromotionsService,
  ) {}

  private async mapPublicListings<
    T extends Parameters<typeof toPublicListing>[0],
  >(rows: T[]) {
    const promotionMap =
      await this.promotionsService.getBestDisplayByListingIds(
        rows.map((r) => r.id),
      );

    return rows.map((row) =>
      toPublicListing(row, promotionMap.get(row.id) ?? null),
    );
  }

  async browse(filters: FilterListingsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 24;
    const skip = (page - 1) * limit;
    const where = this.searchService.buildWhereClause(filters);

    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.searchService.buildOrderByClause(filters.sort),
        include: publicListingInclude,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items: await this.mapPublicListings(rows),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findPublishedCollection(
    extra: Prisma.ListingWhereInput,
    orderBy:
      | Prisma.ListingOrderByWithRelationInput
      | Prisma.ListingOrderByWithRelationInput[],
    limit = 12,
  ) {
    const base = this.searchService.buildCuratedBrowseWhere({});
    const where = this.searchService.buildCollectionWhere(base, extra);

    const rows = await this.prisma.listing.findMany({
      where,
      take: limit,
      orderBy,
      include: publicListingInclude,
    });

    return this.mapPublicListings(rows);
  }

  async recentlyReduced() {
    const ids = await this.promotionsService.findRecentlyReducedListingIds();
    if (ids.length === 0) return [];

    const rows = await this.prisma.listing.findMany({
      where: {
        id: { in: ids },
        status: ListingStatus.PUBLISHED,
        deletedAt: null,
      },
      include: publicListingInclude,
    });

    const order = new Map(ids.map((id, index) => [id, index]));
    rows.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));

    return this.mapPublicListings(rows);
  }

  featured() {
    return this.findPublishedCollection({ isFeatured: true }, [
      { isFeatured: 'desc' },
      { publishedAt: 'desc' },
    ]);
  }

  newArrivals() {
    return this.findPublishedCollection({}, { publishedAt: 'desc' });
  }

  hotDeals() {
    return this.findPublishedCollection({ isHotDeal: true }, [
      { isHotDeal: 'desc' },
      { publishedAt: 'desc' },
    ]);
  }

  localStock() {
    return this.findPublishedCollection(
      { sellerType: SellerType.UZA_RWANDA_STOCK },
      { publishedAt: 'desc' },
    );
  }

  async findBySlug(slug: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        slug,
        status: { in: PUBLIC_MARKETPLACE_STATUSES },
        deletedAt: null,
      },
      include: publicListingInclude,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const promotionDisplay =
      listing.listingPricing?.finalPriceUsd != null
        ? await this.promotionsService.getBestDisplayForListing(
            listing.id,
            listing.listingPricing.finalPriceUsd,
          )
        : null;

    if (listing.status === ListingStatus.SOLD) {
      return toPublicListing(listing, promotionDisplay);
    }

    await this.prisma.listing.update({
      where: { id: listing.id },
      data: { viewCount: { increment: 1 } },
    });

    return toPublicListing(
      { ...listing, viewCount: listing.viewCount + 1 },
      promotionDisplay,
    );
  }

  async createForSeller(
    userId: string,
    dto: CreateListingDto,
    auditContext: RequestAuditContext = {},
  ) {
    this.assertSellerAllowedListingType(dto.sellerType);

    const seller = await this.sellersService.assertSellerCanTrade(userId);
    await this.validateCategoryRefs(dto.categoryId, dto.subcategoryId);

    const slug = await this.uniqueListingSlug(
      dto.brand,
      dto.model,
      dto.manufacturingYear,
    );

    const { pricing: pricingCreate, deliveryDaysMax } =
      await this.resolveListingPricing(
        dto.sellerType,
        dto.country,
        dto.pricing,
      );

    const listing = await this.prisma.listing.create({
      data: this.buildListingCreateData(
        seller.id,
        slug,
        dto,
        pricingCreate,
        deliveryDaysMax,
      ),
      include: publicListingInclude,
    });

    await this.auditService.record({
      userId,
      action: 'listings:created',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        listingTitle: listing.listingTitle,
        slug: listing.slug,
      },
    });

    return toPublicListing(listing);
  }

  async createByAdmin(
    adminUserId: string,
    dto: AdminCreateListingDto,
    auditContext: RequestAuditContext = {},
  ) {
    this.assertAdminOnlyListingType(dto.sellerType);

    const seller = await this.prisma.seller.findUnique({
      where: { id: dto.sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    await this.validateCategoryRefs(dto.categoryId, dto.subcategoryId);

    const initialStatus = dto.initialStatus ?? ListingStatus.PUBLISHED;
    const slug = await this.uniqueListingSlug(
      dto.brand,
      dto.model,
      dto.manufacturingYear,
    );

    const { pricing: pricingCreate, deliveryDaysMax } =
      await this.resolveListingPricing(
        dto.sellerType,
        dto.country,
        dto.pricing,
      );

    const listing = await this.prisma.listing.create({
      data: {
        ...this.buildListingCreateData(
          seller.id,
          slug,
          dto,
          pricingCreate,
          deliveryDaysMax,
        ),
        status: initialStatus,
        publishedAt:
          initialStatus === ListingStatus.PUBLISHED ? new Date() : undefined,
      },
      include: adminListingInclude,
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'listings:admin-created',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        listingTitle: listing.listingTitle,
        slug: listing.slug,
        sellerType: listing.sellerType,
        status: initialStatus,
      },
    });

    return toAdminListing(listing);
  }

  async findMine(userId: string) {
    const seller = await this.resolveSellerForUser(userId);

    const rows = await this.prisma.listing.findMany({
      where: { sellerId: seller.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: publicListingInclude,
    });

    return rows.map((row) => toSellerListing(row));
  }

  async updateOwn(
    userId: string,
    listingId: string,
    dto: UpdateListingDto,
    auditContext: RequestAuditContext = {},
  ) {
    await this.sellersService.assertSellerCanTrade(userId);
    const listing = await this.getOwnedListing(userId, listingId);

    if (
      listing.status !== ListingStatus.DRAFT &&
      listing.status !== ListingStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Only draft or rejected listings can be edited',
      );
    }

    if (dto.sellerType) {
      this.assertSellerAllowedListingType(dto.sellerType);
    }

    if (dto.categoryId || dto.subcategoryId) {
      await this.validateCategoryRefs(
        dto.categoryId ?? listing.categoryId,
        dto.subcategoryId ?? listing.subcategoryId ?? undefined,
      );
    }

    const sellerType = dto.sellerType ?? listing.sellerType;
    const country = dto.country ?? listing.country;
    let pricingCreate:
      | Prisma.ListingPricingCreateWithoutListingInput
      | undefined;
    let deliveryDaysFromPricing: number | undefined;

    if (dto.pricing) {
      const existingPricing = await this.prisma.listingPricing.findUnique({
        where: { listingId },
      });
      const resolved = await this.resolveListingPricing(
        sellerType,
        country,
        dto.pricing,
        existingPricing,
      );
      pricingCreate = resolved.pricing;
      deliveryDaysFromPricing = resolved.deliveryDaysMax;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const core = await tx.listing.update({
        where: { id: listingId },
        data: {
          ...this.buildListingUpdateData(dto),
          ...(deliveryDaysFromPricing !== undefined &&
          dto.deliveryEstimateDays === undefined
            ? { deliveryEstimateDays: deliveryDaysFromPricing }
            : {}),
        },
        include: publicListingInclude,
      });

      if (pricingCreate) {
        await tx.listingPricing.upsert({
          where: { listingId },
          create: {
            listingId,
            ...pricingCreate,
          },
          update: pricingCreate,
        });
      }

      if (dto.evSpecs) {
        await tx.evSpec.upsert({
          where: { listingId },
          create: { listingId, ...dto.evSpecs },
          update: { ...dto.evSpecs },
        });
      }

      if (dto.useCases) {
        await tx.listingUseCase.deleteMany({ where: { listingId } });
        await tx.listingUseCase.createMany({
          data: dto.useCases.map((useCase) => ({ listingId, useCase })),
        });
      }

      return core;
    });

    await this.auditService.record({
      userId,
      action: 'listings:updated',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        slug: updated.slug,
      },
    });

    return toSellerListing(updated);
  }

  async deleteOwn(
    userId: string,
    listingId: string,
    auditContext: RequestAuditContext = {},
  ) {
    await this.sellersService.assertSellerCanTrade(userId);
    const listing = await this.getOwnedListing(userId, listingId);

    if (listing.status !== ListingStatus.DRAFT) {
      throw new BadRequestException('Only draft listings can be deleted');
    }

    await this.prisma.listing.update({
      where: { id: listingId },
      data: { deletedAt: new Date() },
    });

    await this.auditService.record({
      userId,
      action: 'listings:deleted',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        slug: listing.slug,
      },
    });
  }

  async submitForReview(
    userId: string,
    listingId: string,
    auditContext: RequestAuditContext = {},
  ) {
    await this.sellersService.assertSellerCanTrade(userId);
    const listing = await this.getOwnedListing(userId, listingId);

    this.assertTransition(listing.status, ListingStatus.PENDING_REVIEW);

    const photoCount = await this.prisma.listingPhoto.count({
      where: { listingId },
    });

    if (photoCount < 1) {
      throw new BadRequestException(
        'At least one photo is required before submitting for review',
      );
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.PENDING_REVIEW },
      include: publicListingInclude,
    });

    await this.auditService.record({
      userId,
      action: 'listings:submitted',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        slug: updated.slug,
      },
    });

    await this.notificationsService.sendToRoleNames(
      ['MARKETPLACE_ADMIN', 'SUPER_ADMIN'],
      {
        type: NotificationType.SYSTEM_ALERT,
        title: 'Listing submitted for review',
        body: `${updated.listingTitle} is pending approval.`,
        metadata: {
          listingId: updated.id,
          slug: updated.slug,
        },
      },
    );

    return toSellerListing(updated);
  }

  async addPhotos(
    userId: string,
    listingId: string,
    dto: AddListingPhotosDto,
    auditContext: RequestAuditContext = {},
  ) {
    await this.sellersService.assertSellerCanTrade(userId);
    const listing = await this.getOwnedListing(userId, listingId);

    if (
      listing.status !== ListingStatus.DRAFT &&
      listing.status !== ListingStatus.REJECTED
    ) {
      throw new BadRequestException(
        'Photos can only be added to draft or rejected listings',
      );
    }

    const existingCount = await this.prisma.listingPhoto.count({
      where: { listingId },
    });

    if (existingCount + dto.photos.length > 20) {
      throw new BadRequestException('Maximum 20 photos per listing');
    }

    const hasPrimary = await this.prisma.listingPhoto.count({
      where: { listingId, isPrimary: true },
    });

    await this.prisma.listingPhoto.createMany({
      data: dto.photos.map((photo, index) => ({
        listingId,
        url: photo.url,
        altText: photo.altText,
        isPrimary: photo.isPrimary ?? (!hasPrimary && index === 0),
        displayOrder: existingCount + index,
      })),
    });

    const photos = await this.prisma.listingPhoto.findMany({
      where: { listingId },
      orderBy: { displayOrder: 'asc' },
    });

    await this.auditService.record({
      userId,
      action: 'listings:photos-added',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        slug: listing.slug,
        count: dto.photos.length,
      },
    });

    return photos;
  }

  async adminFindAll(filters: AdminFilterListingsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.ListingWhereInput = { deletedAt: null };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.sellerId) {
      where.sellerId = filters.sellerId;
    }

    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: adminListingInclude,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      items: rows.map((row) => toAdminListing(row)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async adminApprove(
    listingId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    return this.transitionListing(
      listingId,
      ListingStatus.APPROVED,
      adminUserId,
      'listings:approved',
      auditContext,
    );
  }

  async adminPublish(
    listingId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const listing = await this.getListingOrThrow(listingId);
    this.assertTransition(listing.status, ListingStatus.PUBLISHED);

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      include: adminListingInclude,
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'listings:published',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        slug: updated.slug,
      },
    });

    await this.notifyListingSeller(updated, {
      type: NotificationType.LISTING_APPROVED,
      title: 'Your listing is now live',
      body: `${updated.listingTitle} has been published on UZA Mobility.`,
      metadata: {
        listingId: updated.id,
        slug: updated.slug,
        status: ListingStatus.PUBLISHED,
      },
    });

    return toAdminListing(updated);
  }

  async adminReject(
    listingId: string,
    adminUserId: string,
    dto: RejectListingDto,
    auditContext: RequestAuditContext = {},
  ) {
    const listing = await this.getListingOrThrow(listingId);
    this.assertTransition(listing.status, ListingStatus.REJECTED);

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.REJECTED,
        adminNotes: dto.reason,
      },
      include: adminListingInclude,
    });

    await this.auditService.record({
      userId: adminUserId,
      action: 'listings:rejected',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        slug: updated.slug,
        reason: dto.reason,
      },
    });

    await this.notifyListingSeller(updated, {
      type: NotificationType.LISTING_REJECTED,
      title: 'Your listing needs changes',
      body: `${updated.listingTitle} was not approved. Reason: ${dto.reason}`,
      metadata: {
        listingId: updated.id,
        slug: updated.slug,
        reason: dto.reason,
      },
    });

    return toAdminListing(updated);
  }

  async adminToggleFeatured(
    listingId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    return this.toggleFlag(
      listingId,
      'isFeatured',
      adminUserId,
      'listings:feature-toggled',
      auditContext,
    );
  }

  async adminToggleHotDeal(
    listingId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    return this.toggleFlag(
      listingId,
      'isHotDeal',
      adminUserId,
      'listings:hot-deal-toggled',
      auditContext,
    );
  }

  async adminHardDelete(
    listingId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const listing = await this.getListingOrThrow(listingId);

    await this.prisma.listing.delete({ where: { id: listingId } });

    await this.auditService.record({
      userId: adminUserId,
      action: 'listings:hard-deleted',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        slug: listing.slug,
      },
    });
  }

  private async transitionListing(
    listingId: string,
    to: ListingStatus,
    adminUserId: string,
    action: string,
    auditContext: RequestAuditContext,
  ) {
    const listing = await this.getListingOrThrow(listingId);
    this.assertTransition(listing.status, to);

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: to },
      include: adminListingInclude,
    });

    await this.auditService.record({
      userId: adminUserId,
      action,
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        slug: updated.slug,
        status: to,
      },
    });

    if (to === ListingStatus.APPROVED) {
      await this.notifyListingSeller(updated, {
        type: NotificationType.LISTING_APPROVED,
        title: 'Your listing has been approved',
        body: `${updated.listingTitle} was approved and can be published by our team.`,
        metadata: {
          listingId: updated.id,
          slug: updated.slug,
          status: to,
        },
      });
    }

    return toAdminListing(updated);
  }

  private async notifyListingSeller(
    listing: ListingSellerNotifyTarget,
    input: {
      type: NotificationType;
      title: string;
      body: string;
      metadata?: NotificationMetadata;
    },
  ) {
    await this.notificationsService.send({
      userId: listing.seller.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      metadata: input.metadata,
    });
  }

  private async toggleFlag(
    listingId: string,
    field: 'isFeatured' | 'isHotDeal',
    adminUserId: string,
    action: string,
    auditContext: RequestAuditContext,
  ) {
    const listing = await this.getListingOrThrow(listingId);

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { [field]: !listing[field] },
      include: adminListingInclude,
    });

    await this.auditService.record({
      userId: adminUserId,
      action,
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        slug: updated.slug,
        [field]: updated[field],
      },
    });

    return toAdminListing(updated);
  }

  private async resolveListingPricing(
    sellerType: SellerType,
    originCountry: string | undefined,
    partial: CreateListingPricingDto,
    existing?: {
      basePriceUsd: number | null;
      fobPriceUsd: number | null;
      sellerDesiredPayoutUsd: number | null;
      discountUsd: number | null;
    } | null,
  ): Promise<{
    pricing: Prisma.ListingPricingCreateWithoutListingInput;
    deliveryDaysMax: number;
  }> {
    const input = existing
      ? mergeListingPricingInput(sellerType, partial, existing)
      : partial;

    if (!existing) {
      assertListingPricingInput(sellerType, input);
    }

    const breakdown = await this.pricingService.calculatePrice(
      sellerType,
      toPricingInput(input),
      originCountry,
    );

    return {
      pricing: breakdownToListingPricingCreate(breakdown),
      deliveryDaysMax: deliveryDaysFromBreakdown(breakdown),
    };
  }

  private buildListingCreateData(
    sellerId: string,
    slug: string,
    dto: CreateListingDto,
    pricingCreate: Prisma.ListingPricingCreateWithoutListingInput,
    deliveryDaysMax: number,
  ): Prisma.ListingCreateInput {
    return {
      seller: { connect: { id: sellerId } },
      category: { connect: { id: dto.categoryId } },
      subcategory: dto.subcategoryId
        ? { connect: { id: dto.subcategoryId } }
        : undefined,
      listingTitle: dto.listingTitle,
      slug,
      status: ListingStatus.DRAFT,
      sellerType: dto.sellerType,
      brand: dto.brand,
      model: dto.model,
      trim: dto.trim,
      manufacturingYear: dto.manufacturingYear,
      isNew: dto.isNew,
      condition: dto.condition,
      bodyType: dto.bodyType,
      powertrainType: dto.powertrainType ?? 'BEV',
      color: dto.color,
      seats: dto.seats,
      steeringPosition: dto.steeringPosition,
      drivetrain: dto.drivetrain,
      mileageKm: dto.mileageKm,
      hasWarranty: dto.hasWarranty ?? false,
      warrantyDetails: dto.warrantyDetails,
      hasAccidentHistory: dto.hasAccidentHistory ?? false,
      ownershipCount: dto.ownershipCount,
      vehicleLocation: dto.vehicleLocation,
      city: dto.city,
      country: dto.country,
      deliveryEstimateDays: dto.deliveryEstimateDays ?? deliveryDaysMax,
      description: dto.description,
      videoUrl: dto.videoUrl,
      listingPricing: {
        create: pricingCreate,
      },
      evSpecs: dto.evSpecs ? { create: { ...dto.evSpecs } } : undefined,
      useCaseTags: dto.useCases?.length
        ? {
            create: dto.useCases.map((useCase) => ({ useCase })),
          }
        : undefined,
    };
  }

  private buildListingUpdateData(
    dto: UpdateListingDto,
  ): Prisma.ListingUpdateInput {
    const data: Prisma.ListingUpdateInput = {
      listingTitle: dto.listingTitle,
      sellerType: dto.sellerType,
      brand: dto.brand,
      model: dto.model,
      trim: dto.trim,
      manufacturingYear: dto.manufacturingYear,
      isNew: dto.isNew,
      condition: dto.condition,
      bodyType: dto.bodyType,
      powertrainType: dto.powertrainType,
      color: dto.color,
      seats: dto.seats,
      steeringPosition: dto.steeringPosition,
      drivetrain: dto.drivetrain,
      mileageKm: dto.mileageKm,
      hasWarranty: dto.hasWarranty,
      warrantyDetails: dto.warrantyDetails,
      hasAccidentHistory: dto.hasAccidentHistory,
      ownershipCount: dto.ownershipCount,
      vehicleLocation: dto.vehicleLocation,
      city: dto.city,
      country: dto.country,
      deliveryEstimateDays: dto.deliveryEstimateDays,
      description: dto.description,
      videoUrl: dto.videoUrl,
    };

    if (dto.categoryId) {
      data.category = { connect: { id: dto.categoryId } };
    }

    if (dto.subcategoryId) {
      data.subcategory = { connect: { id: dto.subcategoryId } };
    }

    return data;
  }

  private async validateCategoryRefs(
    categoryId: string,
    subcategoryId?: string,
  ) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, isActive: true },
    });

    if (!category) {
      throw new BadRequestException('Invalid category');
    }

    if (!subcategoryId) return;

    const subcategory = await this.prisma.subcategory.findFirst({
      where: { id: subcategoryId, categoryId, isActive: true },
    });

    if (!subcategory) {
      throw new BadRequestException('Invalid subcategory for category');
    }
  }

  private async resolveSellerForUser(userId: string) {
    const seller = await this.prisma.seller.findUnique({ where: { userId } });

    if (!seller) {
      throw new ForbiddenException('Seller profile is required');
    }

    return seller;
  }

  private async getOwnedListing(userId: string, listingId: string) {
    const seller = await this.resolveSellerForUser(userId);
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, sellerId: seller.id, deletedAt: null },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  private async getListingOrThrow(listingId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }

  private uniqueListingSlug(brand: string, model: string, year: number) {
    return resolveUniqueSlug(`${brand}-${model}-${year}`, (candidate) =>
      this.prisma.listing
        .findUnique({ where: { slug: candidate } })
        .then((row) => row !== null),
    );
  }

  private assertTransition(from: ListingStatus, to: ListingStatus) {
    if (!canTransition(from, to)) {
      throw new BadRequestException(
        `Cannot transition listing from ${from} to ${to}`,
      );
    }
  }

  private assertSellerAllowedListingType(sellerType: SellerType): void {
    if (ADMIN_ONLY_SELLER_TYPES.includes(sellerType)) {
      throw new ForbiddenException(
        'UZA Rwanda stock and China sourcing listings must be created by an administrator',
      );
    }
  }

  private assertAdminOnlyListingType(sellerType: SellerType): void {
    if (!ADMIN_ONLY_SELLER_TYPES.includes(sellerType)) {
      throw new BadRequestException(
        'Admin direct create is only for UZA_RWANDA_STOCK or UZA_CHINA_SOURCING listings',
      );
    }
  }
}
