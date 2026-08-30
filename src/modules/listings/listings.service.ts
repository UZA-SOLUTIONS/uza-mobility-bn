import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ListingInventoryStage,
  ListingStatus,
  NotificationType,
  Prisma,
  SellerType,
} from '@prisma/client';
import { StorageService } from '../../common/uploads/storage.service';
import type { RequestAuditContext } from '../../common/audit/request-context.util';
import { resolveUniqueSlug } from '../../common/utils/slug.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { ListingPhotoInput } from './dto/listing-photo-input';
import { AdminFilterListingsDto } from './dto/admin-filter-listings.dto';
import { CreateListingDto } from './dto/create-listing.dto';
import { FilterListingsDto } from './dto/filter-listings.dto';
import { RejectListingDto } from './dto/reject-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import type {
  AdminCreateListingPayload,
  AdminUpdateListingPayload,
  ListingUpdateFields,
} from './dto/listing-write.types';
import { canTransition } from './listing-transitions';
import {
  resolveDefaultInventoryStage,
  assertInventoryStageTransition,
} from './listing-inventory.util';
import {
  toAdminListing,
  toPublicListing,
  toSellerListing,
} from './listing.mapper';
import { marketplaceSellerFilter } from '../sellers/seller-profile.util';
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
import { UsersService } from '../../users/users.service';
import {
  assertListingPricingInput,
  breakdownToListingPricingCreate,
  deliveryDaysFromBreakdown,
  mergeListingPricingInput,
  parsePricingRuleIdFromPriceNotes,
  toPricingInput,
} from './listing-pricing.util';
import type { CreateListingPricingDto } from './dto/create-listing-pricing.dto';
import { PromotionsService } from '../promotions/promotions.service';
import { SearchService } from './search.service';
import {
  assertListingEvSpecs,
  mergeListingEvSpecInput,
} from './listing-ev-spec.util';
import type { PreviewListingPricingDto } from './dto/preview-listing-pricing.dto';
import { AuditService } from 'src/common/audit/audit.service';

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
    private readonly usersService: UsersService,
    private readonly pricingService: PricingService,
    private readonly promotionsService: PromotionsService,
    private readonly storage: StorageService,
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

  async getBrowseFilterOptions(categorySlug?: string, brand?: string) {
    const baseFilters: FilterListingsDto = {};
    if (categorySlug) {
      baseFilters.category = categorySlug;
    }
    const where = this.searchService.buildWhereClause(baseFilters);
    if (brand) {
      where.brand = { equals: brand, mode: 'insensitive' };
    }

    const listings = await this.prisma.listing.findMany({
      where,
      select: {
        brand: true,
        model: true,
        condition: true,
        drivetrain: true,
        color: true,
        city: true,
        country: true,
        manufacturingYear: true,
        mileageKm: true,
        listingPricing: { select: { finalPriceUsd: true } },
        evSpecs: { select: { batteryCapacityKwh: true } },
      },
    });

    const brands = new Set<string>();
    const models = new Set<string>();
    const conditions = new Set<string>();
    const drivetrains = new Set<string>();
    const colors = new Set<string>();
    const cities = new Set<string>();
    const countries = new Set<string>();
    const batteryCapacities = new Set<number>();
    let yearMin = Infinity;
    let yearMax = -Infinity;
    let mileageMin = Infinity;
    let mileageMax = -Infinity;
    let priceMin = Infinity;
    let priceMax = -Infinity;

    for (const row of listings) {
      if (row.brand) brands.add(row.brand);
      if (row.model) models.add(row.model);
      if (row.condition) conditions.add(row.condition);
      if (row.drivetrain) drivetrains.add(row.drivetrain);
      if (row.color) colors.add(row.color);
      if (row.city) cities.add(row.city);
      if (row.country) countries.add(row.country);
      if (row.evSpecs?.batteryCapacityKwh != null) {
        batteryCapacities.add(row.evSpecs.batteryCapacityKwh);
      }
      yearMin = Math.min(yearMin, row.manufacturingYear);
      yearMax = Math.max(yearMax, row.manufacturingYear);
      if (row.mileageKm != null) {
        mileageMin = Math.min(mileageMin, row.mileageKm);
        mileageMax = Math.max(mileageMax, row.mileageKm);
      }
      const price = row.listingPricing?.finalPriceUsd;
      if (price != null) {
        priceMin = Math.min(priceMin, price);
        priceMax = Math.max(priceMax, price);
      }
    }

    const sortStrings = (a: string, b: string) => a.localeCompare(b);

    return {
      brands: [...brands].sort(sortStrings),
      models: [...models].sort(sortStrings),
      conditions: [...conditions].sort(),
      drivetrains: [...drivetrains].sort(),
      colors: [...colors].sort(sortStrings),
      cities: [...cities].sort(sortStrings),
      countries: [...countries].sort(sortStrings),
      batteryCapacitiesKwh: [...batteryCapacities].sort((a, b) => a - b),
      yearRange: yearMin === Infinity ? null : { min: yearMin, max: yearMax },
      mileageRange:
        mileageMin === Infinity
          ? null
          : { min: Math.floor(mileageMin), max: Math.ceil(mileageMax) },
      priceRange:
        priceMin === Infinity
          ? null
          : { min: Math.floor(priceMin), max: Math.ceil(priceMax) },
    };
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
    assertListingEvSpecs({ condition: dto.condition, evSpecs: dto.evSpecs });

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
        undefined,
        dto.deliveryEstimateDays,
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

    const withPricing = await this.prisma.listing.findUnique({
      where: { id: listing.id },
      include: publicListingInclude,
    });

    return toSellerListing(withPricing ?? listing);
  }

  async createByAdmin(
    adminUserId: string,
    dto: AdminCreateListingPayload,
    auditContext: RequestAuditContext = {},
  ) {
    this.assertAdminOnlyListingType(dto.sellerType);

    const seller = await this.resolveAdminSellerProfile(
      adminUserId,
      dto.sellerType,
      auditContext,
    );

    await this.validateCategoryRefs(dto.categoryId, dto.subcategoryId);
    assertListingEvSpecs({ condition: dto.condition, evSpecs: dto.evSpecs });

    const initialStatus = dto.initialStatus ?? ListingStatus.PENDING_REVIEW;

    if (
      initialStatus === ListingStatus.PENDING_REVIEW &&
      !dto.photoUrls?.length
    ) {
      throw new BadRequestException(
        'At least one photo is required when submitting for review',
      );
    }
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
        undefined,
        dto.deliveryEstimateDays,
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
        createdBy: { connect: { id: adminUserId } },
        publishedAt: undefined,
        photos: dto.photoUrls?.length
          ? {
              create: dto.photoUrls.map((url, index) => ({
                url,
                isPrimary: index === 0,
                displayOrder: index,
              })),
            }
          : undefined,
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

    if (initialStatus === ListingStatus.PENDING_REVIEW) {
      await this.notificationsService.sendToRoleNames(['SUPER_ADMIN'], {
        type: NotificationType.SYSTEM_ALERT,
        title: 'Listing submitted for review',
        body: `${listing.listingTitle} is pending administrator approval.`,
        metadata: {
          listingId: listing.id,
          slug: listing.slug,
        },
      });
    }

    return toAdminListing(listing);
  }

  async previewPricingForSeller(userId: string, dto: PreviewListingPricingDto) {
    const seller = await this.sellersService.assertSellerCanTrade(userId);
    const sellerType = seller.sellerType;

    if (
      sellerType !== SellerType.LOCAL_SELLER &&
      sellerType !== SellerType.INTERNATIONAL_SELLER
    ) {
      throw new BadRequestException('Unsupported seller type for preview');
    }

    const pricingInput = {
      basePriceUsd: dto.basePriceUsd,
      fobPriceUsd: dto.fobPriceUsd,
      sellerDesiredPayoutUsd: dto.sellerDesiredPayoutUsd,
      discountUsd: dto.discountUsd,
    };

    assertListingPricingInput(sellerType, pricingInput);

    return this.pricingService.calculatePrice(
      sellerType,
      toPricingInput(pricingInput),
      dto.country ?? seller.country,
    );
  }

  async updateCreatedByAdmin(
    adminUserId: string,
    listingId: string,
    dto: AdminUpdateListingPayload,
    auditContext: RequestAuditContext = {},
  ) {
    const listing = await this.assertAdminOwnListingForEdit(
      adminUserId,
      listingId,
    );

    if (dto.sellerType && dto.sellerType !== listing.sellerType) {
      throw new BadRequestException(
        'Inventory channel cannot be changed after creation',
      );
    }

    const {
      removePhotoIds,
      photoOrder,
      primaryPhotoId,
      removeVideo,
      removeBrochure,
      pricing,
      photoUrls,
      status,
      ...listingFields
    } = dto;

    if (status !== undefined && status !== listing.status) {
      this.assertAdminManualStatusChange(listing.status, status);
    }

    const normalizedSubcategoryId =
      listingFields.subcategoryId === ''
        ? undefined
        : listingFields.subcategoryId;

    if (listingFields.categoryId || listingFields.subcategoryId !== undefined) {
      await this.validateCategoryRefs(
        listingFields.categoryId ?? listing.categoryId,
        normalizedSubcategoryId ?? listing.subcategoryId ?? undefined,
      );
    }

    const existingEvSpecs = await this.prisma.evSpec.findUnique({
      where: { listingId },
    });

    if (listingFields.evSpecs || listingFields.condition) {
      assertListingEvSpecs({
        condition: listingFields.condition ?? listing.condition,
        evSpecs: mergeListingEvSpecInput(
          listingFields.evSpecs,
          existingEvSpecs,
        ),
      });
    }

    if (removeVideo && listing.videoUrl) {
      await this.storage.deleteByUrl(listing.videoUrl);
      listingFields.videoUrl = undefined;
    } else if (
      listingFields.videoUrl &&
      listing.videoUrl &&
      listingFields.videoUrl !== listing.videoUrl
    ) {
      await this.storage.deleteByUrl(listing.videoUrl);
    }

    if (removeBrochure && listing.brochureUrl) {
      await this.storage.deleteByUrl(listing.brochureUrl);
      listingFields.brochureUrl = null;
    } else if (
      listingFields.brochureUrl &&
      listing.brochureUrl &&
      listingFields.brochureUrl !== listing.brochureUrl
    ) {
      await this.storage.deleteByUrl(listing.brochureUrl);
    }

    const sellerType = listing.sellerType;
    const country = listingFields.country ?? listing.country;
    let pricingCreate:
      Prisma.ListingPricingCreateWithoutListingInput | undefined;
    let deliveryDaysFromPricing: number | undefined;

    if (pricing) {
      const existingPricing = await this.prisma.listingPricing.findUnique({
        where: { listingId },
      });
      const resolved = await this.resolveListingPricing(
        sellerType,
        country,
        pricing,
        existingPricing,
        listingFields.deliveryEstimateDays,
      );
      pricingCreate = resolved.pricing;
      deliveryDaysFromPricing = resolved.deliveryDaysMax;
    }

    const listingUpdateData = {
      ...this.buildListingUpdateData(listingFields),
      ...(status !== undefined && status !== listing.status ? { status } : {}),
      ...(deliveryDaysFromPricing !== undefined &&
      listingFields.deliveryEstimateDays === undefined
        ? { deliveryEstimateDays: deliveryDaysFromPricing }
        : {}),
    };

    const existingPhotos = [...listing.photos].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
    const currentPhotoIds = existingPhotos.map((photo) => photo.id);
    const currentPrimaryId =
      existingPhotos.find((photo) => photo.isPrimary)?.id ?? null;

    const photoOrderChanged = Boolean(
      photoOrder?.length &&
      (photoOrder.length !== currentPhotoIds.length ||
        photoOrder.some((id, index) => id !== currentPhotoIds[index])),
    );
    const primaryChanged = Boolean(
      primaryPhotoId && primaryPhotoId !== currentPrimaryId,
    );

    const hasListingFieldChanges = this.listingUpdateDataHasChanges(
      listing,
      listingUpdateData,
    );
    const hasMediaFileChanges = Boolean(
      (removePhotoIds?.length ?? 0) > 0 ||
      (photoUrls?.length ?? 0) > 0 ||
      removeVideo ||
      removeBrochure ||
      listingFields.videoUrl ||
      listingFields.brochureUrl,
    );
    const hasPhotoLayoutChanges = photoOrderChanged || primaryChanged;
    const hasPricingChanges = Boolean(
      pricingCreate &&
      this.listingPricingHasChanges(listing.listingPricing, pricingCreate),
    );
    const hasEvSpecsChanges = Boolean(
      listingFields.evSpecs &&
      this.evSpecsHaveChanges(existingEvSpecs, listingFields.evSpecs),
    );
    const hasUseCasesChanges =
      listingFields.useCases !== undefined &&
      this.useCasesHaveChanges(
        listing.useCaseTags?.map((tag) => tag.useCase) ?? [],
        listingFields.useCases,
      );

    if (
      !hasListingFieldChanges &&
      !hasMediaFileChanges &&
      !hasPhotoLayoutChanges &&
      !hasPricingChanges &&
      !hasEvSpecsChanges &&
      !hasUseCasesChanges
    ) {
      return toAdminListing(listing);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (hasListingFieldChanges) {
        await tx.listing.update({
          where: { id: listingId },
          data: listingUpdateData,
        });
      }

      if (hasPricingChanges && pricingCreate) {
        await tx.listingPricing.upsert({
          where: { listingId },
          create: { listingId, ...pricingCreate },
          update: pricingCreate,
        });
      }

      if (removePhotoIds?.length) {
        await this.removeAdminListingPhotos(tx, listingId, removePhotoIds);
      }

      if (hasPhotoLayoutChanges) {
        await this.reorderAdminListingPhotos(
          tx,
          listingId,
          photoOrderChanged ? photoOrder : undefined,
          primaryChanged ? primaryPhotoId : undefined,
        );
      }

      if (photoUrls?.length) {
        await this.appendAdminListingPhotos(tx, listingId, photoUrls);
      }

      if (hasEvSpecsChanges && listingFields.evSpecs) {
        await tx.evSpec.upsert({
          where: { listingId },
          create: { listingId, ...listingFields.evSpecs },
          update: { ...listingFields.evSpecs },
        });
      }

      if (hasUseCasesChanges && listingFields.useCases) {
        await tx.listingUseCase.deleteMany({ where: { listingId } });
        await tx.listingUseCase.createMany({
          data: listingFields.useCases.map((useCase) => ({
            listingId,
            useCase,
          })),
        });
      }

      const photoCount = await tx.listingPhoto.count({
        where: { listingId },
      });

      if (photoCount < 1) {
        throw new BadRequestException('At least one photo is required');
      }

      if (
        !hasListingFieldChanges &&
        (hasMediaFileChanges ||
          hasPhotoLayoutChanges ||
          hasPricingChanges ||
          hasEvSpecsChanges ||
          hasUseCasesChanges)
      ) {
        await tx.listing.update({
          where: { id: listingId },
          data: { updatedAt: new Date() },
        });
      }

      return tx.listing.findUnique({
        where: { id: listingId },
        include: adminListingInclude,
      });
    });

    const updated = result;

    if (!updated) {
      throw new NotFoundException('Listing not found');
    }

    if (
      status === ListingStatus.PENDING_REVIEW &&
      listing.status !== ListingStatus.PENDING_REVIEW
    ) {
      await this.notificationsService.sendToRoleNames(['SUPER_ADMIN'], {
        type: NotificationType.SYSTEM_ALERT,
        title: 'Listing submitted for review',
        body: `${updated.listingTitle} is pending administrator approval.`,
        metadata: {
          listingId: updated.id,
          slug: updated.slug,
        },
      });
    }

    await this.auditService.record({
      userId: adminUserId,
      action: 'listings:admin-updated',
      entity: 'Listing',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        email: auditContext.actorEmail,
        listingTitle: updated.listingTitle,
        slug: updated.slug,
      },
    });

    return toAdminListing(updated);
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
      Prisma.ListingPricingCreateWithoutListingInput | undefined;
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
        dto.deliveryEstimateDays,
      );
      pricingCreate = resolved.pricing;
      deliveryDaysFromPricing = resolved.deliveryDaysMax;
    }

    const existingEvSpecs = await this.prisma.evSpec.findUnique({
      where: { listingId },
    });

    if (dto.evSpecs || dto.condition) {
      assertListingEvSpecs({
        condition: dto.condition ?? listing.condition,
        evSpecs: mergeListingEvSpecInput(dto.evSpecs, existingEvSpecs),
      });
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

    await this.notificationsService.sendToRoleNames(['SUPER_ADMIN'], {
      type: NotificationType.SYSTEM_ALERT,
      title: 'Listing submitted for review',
      body: `${updated.listingTitle} is pending approval.`,
      metadata: {
        listingId: updated.id,
        slug: updated.slug,
      },
    });

    return toSellerListing(updated);
  }

  async addPhotos(
    userId: string,
    listingId: string,
    photoInputs: ListingPhotoInput[],
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

    if (existingCount + photoInputs.length > 20) {
      throw new BadRequestException('Maximum 20 photos per listing');
    }

    const hasPrimary = await this.prisma.listingPhoto.count({
      where: { listingId, isPrimary: true },
    });

    await this.prisma.listingPhoto.createMany({
      data: photoInputs.map((photo, index) => ({
        listingId,
        url: photo.url,
        altText: photo.altText,
        isPrimary: photo.isPrimary ?? (!hasPrimary && index === 0),
        displayOrder: existingCount + index,
      })),
    });

    const savedPhotos = await this.prisma.listingPhoto.findMany({
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
        count: photoInputs.length,
      },
    });

    return savedPhotos;
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

    if (filters.sellerType) {
      where.sellerType = filters.sellerType;
    }

    if (filters.inventoryStage) {
      where.inventoryStage = filters.inventoryStage;
    }

    if (filters.q?.trim()) {
      const q = filters.q.trim();
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        {
          OR: [
            { listingTitle: { contains: q, mode: 'insensitive' } },
            { brand: { contains: q, mode: 'insensitive' } },
            { model: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
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

  async adminUnpublish(
    listingId: string,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    return this.transitionListing(
      listingId,
      ListingStatus.SUSPENDED,
      adminUserId,
      'listings:unpublished',
      auditContext,
    );
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
    deliveryEstimateDays?: number,
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
      partial.pricingRuleId,
    );

    return {
      pricing: breakdownToListingPricingCreate(
        breakdown,
        partial.pricingRuleId,
      ),
      deliveryDaysMax:
        deliveryEstimateDays ?? deliveryDaysFromBreakdown(breakdown),
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
      inventoryStage: resolveDefaultInventoryStage(dto.sellerType),
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
      registrationStatus: dto.registrationStatus,
      vehicleLocation: this.resolveVehicleLocation(dto),
      city: dto.city,
      country: dto.country,
      deliveryEstimateDays: dto.deliveryEstimateDays ?? deliveryDaysMax,
      description: dto.description,
      videoUrl: dto.videoUrl,
      brochureUrl: (dto as AdminCreateListingPayload).brochureUrl,
      isFullOption: dto.isFullOption ?? false,
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
    dto: ListingUpdateFields,
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
      registrationStatus: dto.registrationStatus,
      ...(dto.vehicleLocation !== undefined ||
      dto.city !== undefined ||
      dto.country !== undefined
        ? {
            vehicleLocation: this.resolveVehicleLocation({
              vehicleLocation: dto.vehicleLocation,
              city: dto.city ?? '',
              country: dto.country ?? 'RW',
            }),
          }
        : {}),
      city: dto.city,
      country: dto.country,
      deliveryEstimateDays: dto.deliveryEstimateDays,
      description: dto.description,
      videoUrl: dto.videoUrl,
      brochureUrl: dto.brochureUrl,
      isFullOption: dto.isFullOption,
    };

    if (dto.categoryId) {
      data.category = { connect: { id: dto.categoryId } };
    }

    if (dto.subcategoryId !== undefined) {
      data.subcategory =
        dto.subcategoryId && dto.subcategoryId.length > 0
          ? { connect: { id: dto.subcategoryId } }
          : { disconnect: true };
    }

    return this.stripUndefinedListingUpdate(data);
  }

  private stripUndefinedListingUpdate(
    data: Prisma.ListingUpdateInput,
  ): Prisma.ListingUpdateInput {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    );
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
    const seller = await this.prisma.seller.findFirst({
      where: marketplaceSellerFilter(userId),
    });

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

  /**
   * Admin platform listings use the creating admin's Seller profile (same as
   * seller-owned listings: listing.sellerId → Seller → User).
   */
  private async resolveAdminSellerProfile(
    adminUserId: string,
    sellerType: SellerType,
    auditContext: RequestAuditContext = {},
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let seller = await this.prisma.seller.findUnique({
      where: {
        userId_sellerType: { userId: adminUserId, sellerType },
      },
    });

    if (!seller) {
      await this.usersService.ensureRoleAdded(adminUserId, 'SELLER');

      seller = await this.prisma.seller.create({
        data: {
          userId: adminUserId,
          sellerType,
          status: 'ACTIVE',
          businessName:
            `${user.firstName} ${user.lastName}`.trim() || user.email,
          email: user.email,
          country: 'RW',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      await this.auditService.record({
        userId: adminUserId,
        action: 'sellers:platform-profile-provisioned',
        entity: 'Seller',
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        metadata: {
          email: auditContext.actorEmail ?? user.email,
          sellerType,
          sellerId: seller.id,
        },
      });

      return seller;
    }

    if (seller.status !== 'ACTIVE') {
      seller = await this.prisma.seller.update({
        where: { id: seller.id },
        data: { status: 'ACTIVE', isVerified: true, verifiedAt: new Date() },
      });
    }

    return seller;
  }

  private async assertAdminOwnListingForEdit(
    adminUserId: string,
    listingId: string,
  ) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null },
      include: adminListingInclude,
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.createdByUserId !== adminUserId) {
      throw new ForbiddenException('You can only edit listings you created');
    }

    this.assertAdminOnlyListingType(listing.sellerType);

    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException('Sold listings cannot be edited');
    }

    return listing;
  }

  private assertAdminManualStatusChange(
    from: ListingStatus,
    to: ListingStatus,
  ): void {
    if (from === to) {
      return;
    }

    if (canTransition(from, to)) {
      return;
    }

    if (
      from === ListingStatus.REJECTED &&
      to === ListingStatus.PENDING_REVIEW
    ) {
      return;
    }

    throw new BadRequestException(
      `Cannot change listing status from ${from} to ${to}`,
    );
  }

  private assertAdminOnlyListingType(sellerType: SellerType): void {
    if (!ADMIN_ONLY_SELLER_TYPES.includes(sellerType)) {
      throw new BadRequestException(
        'Admin direct create is only for UZA_RWANDA_STOCK or UZA_CHINA_SOURCING listings',
      );
    }
  }

  private async removeAdminListingPhotos(
    tx: Prisma.TransactionClient,
    listingId: string,
    photoIds: string[],
  ): Promise<void> {
    const uniqueIds = [...new Set(photoIds)];
    if (!uniqueIds.length) {
      return;
    }

    const photos = await tx.listingPhoto.findMany({
      where: { listingId, id: { in: uniqueIds } },
    });

    if (photos.length !== uniqueIds.length) {
      throw new BadRequestException(
        'One or more photos were not found on this listing',
      );
    }

    const removedPrimary = photos.some((photo) => photo.isPrimary);

    await tx.listingPhoto.deleteMany({
      where: { listingId, id: { in: uniqueIds } },
    });

    if (removedPrimary) {
      const nextPrimary = await tx.listingPhoto.findFirst({
        where: { listingId },
        orderBy: { displayOrder: 'asc' },
      });

      if (nextPrimary) {
        await tx.listingPhoto.updateMany({
          where: { listingId },
          data: { isPrimary: false },
        });
        await tx.listingPhoto.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true },
        });
      }
    }
  }

  private async appendAdminListingPhotos(
    tx: Prisma.TransactionClient,
    listingId: string,
    photoUrls: string[],
  ): Promise<void> {
    const existingCount = await tx.listingPhoto.count({
      where: { listingId },
    });

    if (existingCount + photoUrls.length > 20) {
      throw new BadRequestException('Maximum 20 photos per listing');
    }

    const hasPrimary = await tx.listingPhoto.count({
      where: { listingId, isPrimary: true },
    });

    await tx.listingPhoto.createMany({
      data: photoUrls.map((url, index) => ({
        listingId,
        url,
        isPrimary: !hasPrimary && index === 0,
        displayOrder: existingCount + index,
      })),
    });
  }

  private async reorderAdminListingPhotos(
    tx: Prisma.TransactionClient,
    listingId: string,
    photoOrder?: string[],
    primaryPhotoId?: string,
  ): Promise<void> {
    const photos = await tx.listingPhoto.findMany({
      where: { listingId },
      orderBy: { displayOrder: 'asc' },
    });

    if (!photos.length) {
      return;
    }

    if (photoOrder?.length) {
      const uniqueOrder = [...new Set(photoOrder)];
      if (uniqueOrder.length !== photos.length) {
        throw new BadRequestException(
          'photoOrder must include every remaining photo exactly once',
        );
      }

      const photoIds = new Set(photos.map((photo) => photo.id));
      if (uniqueOrder.some((id) => !photoIds.has(id))) {
        throw new BadRequestException(
          'photoOrder contains a photo that is not on this listing',
        );
      }

      for (let index = 0; index < uniqueOrder.length; index += 1) {
        await tx.listingPhoto.update({
          where: { id: uniqueOrder[index] },
          data: { displayOrder: index },
        });
      }
    }

    if (primaryPhotoId) {
      const target = photos.find((photo) => photo.id === primaryPhotoId);
      if (!target) {
        throw new BadRequestException(
          'primaryPhotoId is not a photo on this listing',
        );
      }

      await tx.listingPhoto.updateMany({
        where: { listingId },
        data: { isPrimary: false },
      });
      await tx.listingPhoto.update({
        where: { id: primaryPhotoId },
        data: { isPrimary: true },
      });
    }
  }

  private listingUpdateDataHasChanges(
    listing: {
      listingTitle: string;
      brand: string;
      model: string;
      trim: string | null;
      manufacturingYear: number;
      isNew: boolean;
      condition: string | null;
      bodyType: string | null;
      powertrainType: string | null;
      color: string | null;
      seats: number | null;
      steeringPosition: string | null;
      drivetrain: string | null;
      mileageKm: number | null;
      hasWarranty: boolean | null;
      warrantyDetails: string | null;
      hasAccidentHistory: boolean | null;
      ownershipCount: number | null;
      registrationStatus: string | null;
      city: string | null;
      country: string;
      deliveryEstimateDays: number | null;
      description: string | null;
      videoUrl: string | null;
      brochureUrl: string | null;
      isFullOption: boolean;
      categoryId: string;
      subcategoryId: string | null;
      status: string;
    },
    data: Prisma.ListingUpdateInput,
  ): boolean {
    const scalarChecks: Array<[unknown, unknown]> = [
      [data.listingTitle, listing.listingTitle],
      [data.brand, listing.brand],
      [data.model, listing.model],
      [data.trim, listing.trim],
      [data.manufacturingYear, listing.manufacturingYear],
      [data.isNew, listing.isNew],
      [data.condition, listing.condition],
      [data.bodyType, listing.bodyType],
      [data.powertrainType, listing.powertrainType],
      [data.color, listing.color],
      [data.seats, listing.seats],
      [data.steeringPosition, listing.steeringPosition],
      [data.drivetrain, listing.drivetrain],
      [data.mileageKm, listing.mileageKm],
      [data.hasWarranty, listing.hasWarranty],
      [data.warrantyDetails, listing.warrantyDetails],
      [data.hasAccidentHistory, listing.hasAccidentHistory],
      [data.ownershipCount, listing.ownershipCount],
      [data.registrationStatus, listing.registrationStatus],
      [data.city, listing.city],
      [data.country, listing.country],
      [data.deliveryEstimateDays, listing.deliveryEstimateDays],
      [data.description, listing.description],
      [data.videoUrl, listing.videoUrl],
      [data.brochureUrl, listing.brochureUrl],
      [data.isFullOption, listing.isFullOption],
      [data.status, listing.status],
    ];

    if (
      scalarChecks.some(
        ([next, current]) => next !== undefined && next !== current,
      )
    ) {
      return true;
    }

    if (
      data.category?.connect?.id &&
      data.category.connect.id !== listing.categoryId
    ) {
      return true;
    }

    if (data.subcategory !== undefined) {
      if (
        'disconnect' in data.subcategory &&
        data.subcategory.disconnect &&
        listing.subcategoryId
      ) {
        return true;
      }
      if (
        'connect' in data.subcategory &&
        data.subcategory.connect?.id &&
        data.subcategory.connect.id !== listing.subcategoryId
      ) {
        return true;
      }
    }

    return false;
  }

  private listingPricingHasChanges(
    existing:
      | {
          basePriceUsd: unknown;
          fobPriceUsd: unknown;
          discountUsd: unknown;
          finalPriceUsd: unknown;
          pricingRuleId?: string | null;
          priceNotes?: string | null;
        }
      | null
      | undefined,
    next: Prisma.ListingPricingCreateWithoutListingInput,
  ): boolean {
    if (!existing) {
      return true;
    }

    const asNumber = (value: unknown): number | null => {
      if (value == null) return null;
      const num = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(num) ? num : null;
    };

    return (
      asNumber(next.basePriceUsd) !== asNumber(existing.basePriceUsd) ||
      asNumber(next.fobPriceUsd) !== asNumber(existing.fobPriceUsd) ||
      asNumber(next.discountUsd) !== asNumber(existing.discountUsd) ||
      asNumber(next.finalPriceUsd) !== asNumber(existing.finalPriceUsd) ||
      (next.priceNotes ?? null) !== (existing.priceNotes ?? null)
    );
  }

  private evSpecsHaveChanges(
    existing:
      | {
          rangeKm: number | null;
          batteryHealthPercent: number | null;
          batteryCapacityKwh: unknown;
          batteryHealthReport: boolean;
          fastChargingSupported: boolean | null;
          chargingTimeHours: unknown;
          motorPowerKw: unknown;
          topSpeedKmh: number | null;
          payloadCapacityKg: unknown;
          grossVehicleWeightKg: unknown;
        }
      | null
      | undefined,
    next: NonNullable<AdminUpdateListingPayload['evSpecs']>,
  ): boolean {
    if (!existing) {
      return true;
    }

    const asNumber = (value: unknown): number | null => {
      if (value == null) return null;
      const num = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(num) ? num : null;
    };

    return (
      (next.rangeKm ?? null) !== (existing.rangeKm ?? null) ||
      (next.batteryHealthPercent ?? null) !==
        (existing.batteryHealthPercent ?? null) ||
      asNumber(next.batteryCapacityKwh) !==
        asNumber(existing.batteryCapacityKwh) ||
      (next.batteryHealthReport ?? false) !== existing.batteryHealthReport ||
      (next.fastChargingSupported ?? null) !==
        (existing.fastChargingSupported ?? null) ||
      asNumber(next.chargingTimeHours) !==
        asNumber(existing.chargingTimeHours) ||
      asNumber(next.motorPowerKw) !== asNumber(existing.motorPowerKw) ||
      (next.topSpeedKmh ?? null) !== (existing.topSpeedKmh ?? null) ||
      asNumber(next.payloadCapacityKg) !==
        asNumber(existing.payloadCapacityKg) ||
      asNumber(next.grossVehicleWeightKg) !==
        asNumber(existing.grossVehicleWeightKg)
    );
  }

  private useCasesHaveChanges(existing: string[], next: string[]): boolean {
    if (existing.length !== next.length) {
      return true;
    }
    const current = [...existing].sort();
    const incoming = [...next].sort();
    return current.some((value, index) => value !== incoming[index]);
  }

  async advanceInventoryStage(
    listingId: string,
    stage: ListingInventoryStage,
    adminUserId: string,
    auditContext: RequestAuditContext = {},
  ) {
    const listing = await this.prisma.listing.findFirst({
      where: { id: listingId, deletedAt: null },
      include: {
        seller: { select: { userId: true, sellerType: true } },
        listingPricing: true,
      },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const ownerUserId = listing.createdByUserId ?? listing.seller.userId;

    // Heal listings already in Kigali that still show the China sourcing channel.
    if (
      listing.inventoryStage === ListingInventoryStage.KIGALI_STOCK &&
      stage === ListingInventoryStage.KIGALI_STOCK &&
      (listing.sellerType === SellerType.UZA_CHINA_SOURCING ||
        listing.listingPricing?.basePriceUsd == null)
    ) {
      const rwandaSeller = await this.resolveAdminSellerProfile(
        ownerUserId,
        SellerType.UZA_RWANDA_STOCK,
        auditContext,
      );
      await this.prisma.listing.update({
        where: { id: listingId },
        data: {
          sellerType: SellerType.UZA_RWANDA_STOCK,
          country: 'RW',
          city: listing.city?.trim() || 'Kigali',
          kigaliArrivedAt: listing.kigaliArrivedAt ?? new Date(),
          seller: { connect: { id: rwandaSeller.id } },
        },
      });
      await this.migratePricingForInventoryChannel(
        listingId,
        SellerType.UZA_RWANDA_STOCK,
        'RW',
      );
      await this.auditService.record({
        userId: adminUserId,
        action: 'listings:inventory-channel-synced',
        entity: 'Listing',
        entityId: listingId,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        metadata: {
          fromSellerType: listing.sellerType,
          toSellerType: SellerType.UZA_RWANDA_STOCK,
          pricingMigrated: true,
        },
      });
      const refreshed = await this.prisma.listing.findFirstOrThrow({
        where: { id: listingId },
        include: adminListingInclude,
      });
      return toAdminListing(refreshed);
    }

    assertInventoryStageTransition(listing.inventoryStage, stage);

    const data: Prisma.ListingUpdateInput = {
      inventoryStage: stage,
    };

    if (stage === ListingInventoryStage.IN_TRANSIT) {
      data.inventoryPaidAt = listing.inventoryPaidAt ?? new Date();
    }
    if (stage === ListingInventoryStage.AT_PORT) {
      data.portArrivedAt = listing.portArrivedAt ?? new Date();
    }

    const movingIntoKigali =
      stage === ListingInventoryStage.KIGALI_STOCK &&
      listing.inventoryStage !== ListingInventoryStage.KIGALI_STOCK;
    const movingOutOfKigali =
      listing.inventoryStage === ListingInventoryStage.KIGALI_STOCK &&
      stage !== ListingInventoryStage.KIGALI_STOCK;

    if (movingIntoKigali) {
      data.kigaliArrivedAt = listing.kigaliArrivedAt ?? new Date();
      data.sellerType = SellerType.UZA_RWANDA_STOCK;
      data.country = 'RW';
      data.city = listing.city?.trim() || 'Kigali';
      const rwandaSeller = await this.resolveAdminSellerProfile(
        ownerUserId,
        SellerType.UZA_RWANDA_STOCK,
        auditContext,
      );
      data.seller = { connect: { id: rwandaSeller.id } };
    }

    if (movingOutOfKigali) {
      // Pipeline vehicles leaving Kigali return to China-sourcing channel.
      data.sellerType = SellerType.UZA_CHINA_SOURCING;
      if (!listing.country || listing.country === 'RW') {
        data.country = 'CN';
      }
      const chinaSeller = await this.resolveAdminSellerProfile(
        ownerUserId,
        SellerType.UZA_CHINA_SOURCING,
        auditContext,
      );
      data.seller = { connect: { id: chinaSeller.id } };
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data,
      include: adminListingInclude,
    });

    if (movingIntoKigali) {
      await this.migratePricingForInventoryChannel(
        listingId,
        SellerType.UZA_RWANDA_STOCK,
        updated.country,
      );
    } else if (movingOutOfKigali) {
      await this.migratePricingForInventoryChannel(
        listingId,
        SellerType.UZA_CHINA_SOURCING,
        updated.country,
      );
    }

    await this.auditService.record({
      userId: adminUserId,
      action: 'listings:inventory-stage',
      entity: 'Listing',
      entityId: listingId,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        from: listing.inventoryStage,
        to: stage,
        sellerType: updated.sellerType,
      },
    });

    const refreshed = await this.prisma.listing.findFirstOrThrow({
      where: { id: listingId },
      include: adminListingInclude,
    });
    return toAdminListing(refreshed);
  }

  /**
   * China listings store FOB; Rwanda stock expects basePriceUsd.
   * Keep the buyer list price stable when switching channels.
   */
  private async migratePricingForInventoryChannel(
    listingId: string,
    targetSellerType: SellerType,
    originCountry: string | null | undefined,
  ) {
    const pricing = await this.prisma.listingPricing.findUnique({
      where: { listingId },
    });
    if (!pricing) return;

    const pricingRuleId = parsePricingRuleIdFromPriceNotes(pricing.priceNotes);

    const asNumber = (value: Prisma.Decimal | number | null | undefined) =>
      value == null ? null : Number(value);

    if (targetSellerType === SellerType.UZA_RWANDA_STOCK) {
      const basePriceUsd =
        asNumber(pricing.basePriceUsd) ??
        asNumber(pricing.finalPriceUsd) ??
        asNumber(pricing.fobPriceUsd);
      if (basePriceUsd == null) return;

      const { pricing: nextPricing } = await this.resolveListingPricing(
        SellerType.UZA_RWANDA_STOCK,
        originCountry ?? 'RW',
        {
          basePriceUsd,
          discountUsd: asNumber(pricing.discountUsd) ?? undefined,
          pricingRuleId,
        },
      );

      // Preserve the published buyer list price through the channel switch.
      nextPricing.finalPriceUsd = pricing.finalPriceUsd;
      if (pricing.fobPriceUsd != null) {
        nextPricing.fobPriceUsd = pricing.fobPriceUsd;
      }

      await this.prisma.listingPricing.update({
        where: { listingId },
        data: nextPricing,
      });
      return;
    }

    if (targetSellerType === SellerType.UZA_CHINA_SOURCING) {
      const fobPriceUsd =
        asNumber(pricing.fobPriceUsd) ??
        asNumber(pricing.basePriceUsd) ??
        asNumber(pricing.finalPriceUsd);
      if (fobPriceUsd == null) return;

      const { pricing: nextPricing } = await this.resolveListingPricing(
        SellerType.UZA_CHINA_SOURCING,
        originCountry ?? 'CN',
        {
          fobPriceUsd,
          discountUsd: asNumber(pricing.discountUsd) ?? undefined,
          pricingRuleId,
        },
      );

      if (pricing.basePriceUsd != null) {
        nextPricing.basePriceUsd = pricing.basePriceUsd;
      }

      await this.prisma.listingPricing.update({
        where: { listingId },
        data: nextPricing,
      });
    }
  }

  async getWishlistIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.savedListing.findMany({
      where: { userId },
      select: { listingId: true },
      orderBy: { savedAt: 'desc' },
    });

    return rows.map((row) => row.listingId);
  }

  async getWishlist(userId: string) {
    const rows = await this.prisma.savedListing.findMany({
      where: { userId },
      orderBy: { savedAt: 'desc' },
      include: {
        listing: {
          include: publicListingInclude,
        },
      },
    });

    const published = rows
      .map((row) => row.listing)
      .filter(
        (listing) =>
          listing.status === ListingStatus.PUBLISHED && !listing.deletedAt,
      );

    return this.mapPublicListings(published);
  }

  async addToWishlist(userId: string, listingId: string) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: listingId,
        status: ListingStatus.PUBLISHED,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    await this.prisma.savedListing.upsert({
      where: {
        userId_listingId: { userId, listingId },
      },
      create: { userId, listingId },
      update: { savedAt: new Date() },
    });

    return { message: 'Saved to wishlist' };
  }

  async removeFromWishlist(userId: string, listingId: string) {
    await this.prisma.savedListing.deleteMany({
      where: { userId, listingId },
    });

    return { message: 'Removed from wishlist' };
  }

  private resolveVehicleLocation(dto: {
    vehicleLocation?: string;
    city: string;
    country: string;
  }): string {
    const trimmed = dto.vehicleLocation?.trim();
    if (trimmed) return trimmed;

    const countryLabel =
      dto.country === 'CN'
        ? 'China'
        : dto.country === 'RW'
          ? 'Rwanda'
          : dto.country;

    return `${dto.city}, ${countryLabel}`;
  }
}
