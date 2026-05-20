# DOC 02 — Listings & Marketplace
**Uza Mobility · NestJS Backend**

---

## Overview

This is the core of the platform. Everything a public user sees — browsing, filtering, comparing, and requesting invoices — starts here. This doc covers categories, listings, EV specs, photos, search/filtering, verification, and use case tagging.

---

## Module Breakdown

```
src/modules/
├── categories/
│   ├── categories.module.ts
│   ├── categories.controller.ts
│   ├── categories.service.ts
│   └── dto/
│       ├── create-category.dto.ts
│       └── create-subcategory.dto.ts
│
└── listings/
    ├── listings.module.ts
    ├── listings.controller.ts
    ├── listings.service.ts
    ├── search.service.ts
    ├── verification.service.ts
    └── dto/
        ├── create-listing.dto.ts
        ├── update-listing.dto.ts
        ├── filter-listings.dto.ts
        └── update-verification.dto.ts
```

---

## Listing Lifecycle

A listing always moves through these statuses in order. No skipping allowed — enforce this in the service layer.

```
DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED
                       ↘ REJECTED

PUBLISHED → RESERVED  (when invoice is requested and payment pending)
PUBLISHED → SOLD      (when payment confirmed)
PUBLISHED → SUSPENDED (admin action)
PUBLISHED → EXPIRED   (cron job after expiresAt)
```

**State machine enforcement:**

```typescript
// listings/listing-transitions.ts

const ALLOWED_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT:          ['PENDING_REVIEW'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED:       ['PUBLISHED', 'REJECTED'],
  PUBLISHED:      ['RESERVED', 'SOLD', 'SUSPENDED', 'EXPIRED', 'ARCHIVED'],
  RESERVED:       ['PUBLISHED', 'SOLD'],  // released back if payment fails
  REJECTED:       ['DRAFT'],              // seller can fix and resubmit
  SUSPENDED:      ['PUBLISHED'],          // admin can reinstate
  SOLD:           ['ARCHIVED'],
  EXPIRED:        ['DRAFT'],
  ARCHIVED:       [],
}

export function canTransition(from: ListingStatus, to: ListingStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
```

---

## Categories

Seeded from the spec. Categories are managed by admins only — no public creation.

### Seed Data

```typescript
// seeds/categories.seed.ts

const categories = [
  {
    name: 'Passenger Electric Vehicles',
    slug: 'passenger-ev',
    type: 'PASSENGER_EV',
    subcategories: [
      'Sedan', 'SUV', 'Hatchback', 'Crossover',
      'Coupe', 'MPV', 'Pick-up Truck', 'Wagon', 'Minivan',
    ],
  },
  {
    name: 'Electric Two & Three-Wheel',
    slug: 'two-three-wheel',
    type: 'TWO_THREE_WHEEL',
    subcategories: [
      'Electric Motorcycle', 'Electric Scooter', 'Electric Bicycle',
      'Electric Tricycle', 'Electric Cargo Bike', 'Electric Delivery Motorcycle',
    ],
  },
  {
    name: 'Commercial Electric Vehicles',
    slug: 'commercial-ev',
    type: 'COMMERCIAL_EV',
    subcategories: [
      'Electric Bus', 'Electric Minibus', 'Electric Van',
      'Electric Cargo Van', 'Electric Truck', 'Electric Light Truck',
      'Electric Heavy-Duty Truck', 'Electric Utility Vehicle',
      'Electric Delivery Vehicle', 'Electric Forklift',
      'Electric Industrial Vehicle', 'Electric Shuttle',
    ],
  },
  {
    name: 'EV Parts & Accessories',
    slug: 'ev-parts',
    type: 'EV_PARTS_ACCESSORIES',
    subcategories: [
      'Batteries', 'Battery Management Systems', 'Charging Equipment',
      'Tires', 'Brake Components', 'Electric Motors',
      'Power Electronics', 'Diagnostic Tools', 'Cabin Accessories',
    ],
  },
  {
    name: 'EV Infrastructure & Energy',
    slug: 'ev-energy',
    type: 'EV_INFRASTRUCTURE_ENERGY',
    subcategories: [
      'Home Chargers', 'Commercial Chargers', 'Fleet Charging Systems',
      'DC Fast Chargers', 'Solar EV Packages', 'Battery Storage',
      'Smart Charging Systems', 'Energy Management',
    ],
  },
]
```

### Category Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/categories` | Public | List all active categories with subcategories |
| `GET` | `/categories/:slug` | Public | Single category with subcategories |
| `POST` | `/categories` | `MARKETPLACE_ADMIN` | Create category |
| `POST` | `/categories/:id/subcategories` | `MARKETPLACE_ADMIN` | Add subcategory |
| `PATCH` | `/categories/:id` | `MARKETPLACE_ADMIN` | Update category |
| `DELETE` | `/categories/:id` | `SUPER_ADMIN` | Soft delete category |

---

## Listing Endpoints

### Public Routes

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/listings` | Public | Browse with full filtering |
| `GET` | `/listings/:slug` | Public | Single listing detail |
| `GET` | `/listings/featured` | Public | Featured listings for homepage |
| `GET` | `/listings/new-arrivals` | Public | Latest published listings |
| `GET` | `/listings/hot-deals` | Public | `isHotDeal = true` listings |
| `GET` | `/listings/local-stock` | Public | `sellerType = UZA_RWANDA_STOCK` |

### Seller Routes

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/listings` | `SELLER` + `listings:create` | Submit new listing |
| `GET` | `/listings/my` | `SELLER` | Own listings only |
| `PATCH` | `/listings/:id` | `SELLER` (owner check) | Edit own draft/rejected listing |
| `DELETE` | `/listings/:id` | `SELLER` (owner check) | Delete own draft |
| `POST` | `/listings/:id/submit` | `SELLER` (owner check) | Submit draft for review |

### Admin Routes

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/admin/listings` | `MARKETPLACE_ADMIN` | All listings with status filter |
| `PATCH` | `/admin/listings/:id/approve` | `listings:approve` | Approve listing |
| `PATCH` | `/admin/listings/:id/reject` | `listings:reject` | Reject with reason |
| `PATCH` | `/admin/listings/:id/feature` | `listings:feature` | Toggle featured |
| `PATCH` | `/admin/listings/:id/hot-deal` | `listings:feature` | Toggle hot deal |
| `PATCH` | `/admin/listings/:id/verification` | `listings:approve` | Update verification level |
| `DELETE` | `/admin/listings/:id` | `listings:delete` | Hard delete |

---

## Create Listing DTO

```typescript
// dto/create-listing.dto.ts

export class CreateListingDto {
  // Basic
  @IsString() listingTitle: string
  @IsString() categoryId: string
  @IsOptional() @IsString() subcategoryId?: string
  @IsEnum(SellerType) sellerType: SellerType
  @IsString() brand: string
  @IsString() model: string
  @IsOptional() @IsString() trim?: string
  @IsInt() @Min(1990) manufacturingYear: number
  @IsBoolean() isNew: boolean
  @IsEnum(ConditionLevel) condition: ConditionLevel
  @IsOptional() @IsEnum(BodyType) bodyType?: BodyType
  @IsEnum(PowertrainType) @IsOptional() powertrainType?: PowertrainType
  @IsOptional() @IsString() color?: string
  @IsOptional() @IsInt() seats?: number
  @IsOptional() @IsEnum(SteeringPosition) steeringPosition?: SteeringPosition
  @IsOptional() @IsEnum(DrivetrainType) drivetrain?: DrivetrainType
  @IsOptional() @IsNumber() mileageKm?: number
  @IsOptional() @IsBoolean() hasWarranty?: boolean
  @IsOptional() @IsString() warrantyDetails?: string
  @IsOptional() @IsBoolean() hasAccidentHistory?: boolean
  @IsOptional() @IsInt() ownershipCount?: number
  @IsString() vehicleLocation: string
  @IsString() city: string
  @IsString() country: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsString() videoUrl?: string

  // EV Specs (nested)
  @IsOptional() @ValidateNested() @Type(() => CreateEvSpecDto)
  evSpecs?: CreateEvSpecDto

  // Pricing (nested)
  @ValidateNested() @Type(() => CreateListingPricingDto)
  pricing: CreateListingPricingDto

  // Use cases
  @IsOptional() @IsArray() @IsEnum(UseCase, { each: true })
  useCases?: UseCase[]
}

export class CreateEvSpecDto {
  @IsOptional() @IsNumber() batteryCapacityKwh?: number
  @IsOptional() @IsNumber() @Min(0) @Max(100) batteryHealthPercent?: number
  @IsOptional() @IsBoolean() batteryHealthReport?: boolean
  @IsOptional() @IsNumber() rangeKm?: number
  @IsOptional() @IsString() chargingType?: string
  @IsOptional() @IsBoolean() fastChargingSupported?: boolean
  @IsOptional() @IsNumber() chargingTimeHours?: number
  @IsOptional() @IsNumber() motorPowerKw?: number
  @IsOptional() @IsNumber() topSpeedKmh?: number
  @IsOptional() @IsNumber() payloadCapacityKg?: number
  @IsOptional() @IsNumber() grossVehicleWeightKg?: number
  @IsOptional() @IsInt() seatingCapacity?: number
}
```

---

## Filter Listings DTO

This drives the search endpoint. Every field is optional and combinable.

```typescript
// dto/filter-listings.dto.ts

export class FilterListingsDto {
  @IsOptional() @IsString() q?: string               // keyword search
  @IsOptional() @IsString() category?: string        // category slug
  @IsOptional() @IsString() subcategory?: string
  @IsOptional() @IsString() brand?: string
  @IsOptional() @IsString() model?: string
  @IsOptional() @IsEnum(SellerType) sellerType?: SellerType
  @IsOptional() @IsEnum(ConditionLevel) condition?: ConditionLevel
  @IsOptional() @IsBoolean() isNew?: boolean
  @IsOptional() @IsString() country?: string
  @IsOptional() @IsString() city?: string
  @IsOptional() @IsInt() yearMin?: number
  @IsOptional() @IsInt() yearMax?: number
  @IsOptional() @IsNumber() priceMin?: number
  @IsOptional() @IsNumber() priceMax?: number
  @IsOptional() @IsNumber() mileageMax?: number
  @IsOptional() @IsNumber() batteryHealthMin?: number
  @IsOptional() @IsNumber() rangeMin?: number
  @IsOptional() @IsNumber() batteryCapacityMin?: number
  @IsOptional() @IsString() chargingType?: string
  @IsOptional() @IsBoolean() fastCharging?: boolean
  @IsOptional() @IsEnum(VerificationLevel) verificationLevel?: VerificationLevel
  @IsOptional() @IsBoolean() financingAvailable?: boolean
  @IsOptional() @IsInt() deliveryDaysMax?: number
  @IsOptional() @IsEnum(UseCase) useCase?: UseCase
  @IsOptional() @IsEnum(SortOption) sort?: SortOption
  @IsOptional() @IsInt() @Min(1) page?: number
  @IsOptional() @IsInt() @Min(1) @Max(48) limit?: number
}

enum SortOption {
  NEWEST       = 'newest',
  PRICE_LOW    = 'price_low',
  PRICE_HIGH   = 'price_high',
  BEST_SCORE   = 'best_score',
  LOWEST_KM    = 'lowest_km',
  BATTERY_HIGH = 'battery_high',
  RANGE_HIGH   = 'range_high',
  FAST_DELIVER = 'fast_deliver',
  MOST_VIEWED  = 'most_viewed',
  FEATURED     = 'featured',
}
```

---

## Search Service

Handles filtering logic with Prisma `where` clauses built dynamically.

```typescript
// listings/search.service.ts

@Injectable()
export class SearchService {
  buildWhereClause(filters: FilterListingsDto): Prisma.ListingWhereInput {
    const where: Prisma.ListingWhereInput = {
      status: 'PUBLISHED',
      deletedAt: null,
    }

    if (filters.q) {
      where.OR = [
        { listingTitle: { contains: filters.q, mode: 'insensitive' } },
        { brand: { contains: filters.q, mode: 'insensitive' } },
        { model: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
      ]
    }

    if (filters.category)    where.category = { slug: filters.category }
    if (filters.subcategory) where.subcategory = { slug: filters.subcategory }
    if (filters.brand)       where.brand = { equals: filters.brand, mode: 'insensitive' }
    if (filters.sellerType)  where.sellerType = filters.sellerType
    if (filters.condition)   where.condition = filters.condition
    if (filters.isNew !== undefined) where.isNew = filters.isNew
    if (filters.country)     where.country = filters.country
    if (filters.city)        where.city = { contains: filters.city, mode: 'insensitive' }

    if (filters.yearMin || filters.yearMax) {
      where.manufacturingYear = {
        gte: filters.yearMin,
        lte: filters.yearMax,
      }
    }

    if (filters.priceMin || filters.priceMax) {
      where.listingPricing = {
        finalPriceUsd: {
          gte: filters.priceMin,
          lte: filters.priceMax,
        }
      }
    }

    if (filters.batteryHealthMin || filters.rangeMin) {
      where.evSpecs = {
        batteryHealthPercent: filters.batteryHealthMin
          ? { gte: filters.batteryHealthMin } : undefined,
        rangeKm: filters.rangeMin
          ? { gte: filters.rangeMin } : undefined,
        fastChargingSupported: filters.fastCharging ?? undefined,
      }
    }

    if (filters.useCase) {
      where.useCaseTags = {
        some: { useCase: filters.useCase }
      }
    }

    return where
  }

  buildOrderByClause(sort?: SortOption): Prisma.ListingOrderByWithRelationInput {
    const map: Record<SortOption, Prisma.ListingOrderByWithRelationInput> = {
      newest:       { createdAt: 'desc' },
      price_low:    { listingPricing: { finalPriceUsd: 'asc' } },
      price_high:   { listingPricing: { finalPriceUsd: 'desc' } },
      lowest_km:    { mileageKm: 'asc' },
      battery_high: { evSpecs: { batteryHealthPercent: 'desc' } },
      range_high:   { evSpecs: { rangeKm: 'desc' } },
      fast_deliver: { deliveryEstimateDays: 'asc' },
      most_viewed:  { viewCount: 'desc' },
      featured:     { isFeatured: 'desc' },
      best_score:   { verificationLevel: 'desc' },
    }
    return map[sort ?? 'newest']
  }
}
```

---

## Photo Upload Flow

Photos are uploaded separately after listing creation. Don't block listing creation on photos.

```
POST /listings/:id/photos  (multipart/form-data)
→ Multer receives files
→ StorageService uploads to S3/R2
→ Returns public URLs
→ ListingPhoto records created in DB
→ First photo auto-set as isPrimary if none exists
```

**Constraints:**
- Max 20 photos per listing
- Accepted: JPG, PNG, WebP
- Max size per file: 5MB
- At least 1 photo required before listing can be submitted for review

---

## Verification Service

Admin-only. Updates verification level and stores the report.

```typescript
// listings/verification.service.ts

async updateVerification(
  listingId: string,
  dto: UpdateVerificationDto,
  adminId: string,
): Promise<void> {
  await this.prisma.$transaction([
    this.prisma.listing.update({
      where: { id: listingId },
      data: { verificationLevel: dto.verificationLevel },
    }),
    this.prisma.verificationReport.upsert({
      where: { listingId },
      create: { listingId, ...dto, verifiedAt: new Date() },
      update: { ...dto, verifiedAt: new Date() },
    }),
    this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'listings:verification-updated',
        entity: 'Listing',
        entityId: listingId,
        metadata: { verificationLevel: dto.verificationLevel },
      },
    }),
  ])
}
```

---

## Slug Generation

Auto-generate from brand + model + year + cuid fragment. Never expose cuid alone in URLs.

```typescript
// utils/slug.util.ts

export function generateListingSlug(brand: string, model: string, year: number): string {
  const base = `${brand}-${model}-${year}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const suffix = cuid2.createId().slice(0, 8)
  return `${base}-${suffix}`
  // e.g. "byd-atto-3-2024-clh3z2k0"
}
```

---

## View Count

Increment on every public listing detail request. Use a debounced approach — don't increment if the same IP hit the same listing in the last 30 minutes. Store IP+listingId in Redis with 30-min TTL.

```typescript
async incrementViewCount(listingId: string, ip: string): Promise<void> {
  const key = `view:${listingId}:${ip}`
  const exists = await this.redis.get(key)
  if (exists) return

  await Promise.all([
    this.redis.setex(key, 1800, '1'),  // 30 min TTL
    this.prisma.listing.update({
      where: { id: listingId },
      data: { viewCount: { increment: 1 } },
    }),
  ])
}
```

---

## Admin Approval Flow with Notifications

```typescript
async approveListing(listingId: string, adminId: string): Promise<void> {
  const listing = await this.prisma.listing.findUniqueOrThrow({
    where: { id: listingId },
    include: { seller: { include: { user: true } } },
  })

  if (!canTransition(listing.status, 'APPROVED')) {
    throw new BadRequestException(`Cannot approve listing in status ${listing.status}`)
  }

  await this.prisma.$transaction([
    this.prisma.listing.update({
      where: { id: listingId },
      data: { status: 'APPROVED' },
    }),
    this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'listings:approved',
        entity: 'Listing',
        entityId: listingId,
      },
    }),
  ])

  // Notify seller
  await this.notificationsService.send({
    userId: listing.seller.userId,
    type: 'LISTING_APPROVED',
    title: 'Your listing has been approved',
    body: `${listing.listingTitle} is now live on Uza Mobility.`,
    metadata: { listingId, slug: listing.slug },
  })
}
```

---

## Key Business Rules

- A `SELLER` can only edit or delete their **own** listings. Enforce with an ownership check before every mutation.
- A listing cannot be submitted for review without at least **1 photo**.
- When a listing is `SOLD`, it stays visible with a "Sold" badge — don't hide it immediately.
- When a listing is `RESERVED`, show "Reserved - Pending Payment" publicly.
- `adminNotes` field is **never** returned in public API responses. Strip it in the response transformer.
- Listings with `sellerType = UZA_RWANDA_STOCK` or `UZA_CHINA_SOURCING` are created directly by admins, not through the seller submission flow.
