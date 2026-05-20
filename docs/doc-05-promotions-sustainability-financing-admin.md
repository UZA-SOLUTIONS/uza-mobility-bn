# DOC 05 — Promotions, Sustainability, Financing & Admin
**Uza Mobility · NestJS Backend**

---

## Overview

This doc covers the final layer of the platform — how the platform monetizes (promotions and advertising), how it tracks environmental impact (sustainability), how financing facilitation works, and how the admin system is structured across all roles.

---

## Module Breakdown

```
src/modules/
├── promotions/
│   ├── promotions.module.ts
│   ├── promotions.controller.ts
│   ├── promotions.service.ts
│   └── dto/
│       ├── create-promotion.dto.ts
│       └── attach-promotion.dto.ts
│
├── sustainability/
│   ├── sustainability.module.ts
│   ├── sustainability.controller.ts
│   ├── sustainability.service.ts
│   └── dto/
│       └── filter-impact.dto.ts
│
├── financing/
│   ├── financing.module.ts
│   ├── financing.controller.ts
│   ├── financing.service.ts
│   └── dto/
│       └── create-financing-request.dto.ts
│
└── admin/
    ├── admin.module.ts
    ├── dashboard.controller.ts
    └── dashboard.service.ts
```

---

## Promotions & Advertising

### How Promotions Work

Promotions are admin-created campaigns. They can be attached to one or many listings. When a listing has an active promotion attached, it affects how it appears on the marketplace (featured badge, reduced price display, homepage placement, etc.).

The system does not automatically apply promotions. An admin creates the promotion, then attaches eligible listings to it.

```
Admin creates Promotion (type, dates, discount, placement)
→ Admin attaches listings to promotion
→ System checks active promotions on every listing query
→ Active promotion modifies display price and badge
→ Promotion expires automatically via cron
```

### Promotion Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/promotions/active` | Public | Active promotions for homepage banners |
| `GET` | `/admin/promotions` | `ADVERTISING_ADMIN` | All promotions |
| `POST` | `/admin/promotions` | `promotions:create` | Create promotion |
| `PATCH` | `/admin/promotions/:id` | `promotions:manage` | Update promotion |
| `DELETE` | `/admin/promotions/:id` | `promotions:manage` | Deactivate promotion |
| `POST` | `/admin/promotions/:id/listings` | `promotions:manage` | Attach listings |
| `DELETE` | `/admin/promotions/:id/listings/:listingId` | `promotions:manage` | Detach listing |

### Create Promotion DTO

```typescript
// dto/create-promotion.dto.ts

export class CreatePromotionDto {
  @IsString() name: string
  @IsEnum(PromotionType) type: PromotionType
  @IsOptional() @IsString() sponsorName?: string
  @IsOptional() @IsNumber() @Min(0) discountAmountUsd?: number
  @IsOptional() @IsNumber() @Min(0) @Max(100) discountPercent?: number
  @IsOptional() @IsString() bannerImageUrl?: string
  @IsOptional() @IsString() bannerPlacement?: string
  @IsDateString() startDate: string
  @IsDateString() endDate: string
  @IsOptional() @IsUrl() clickUrl?: string
  @IsOptional() @IsString() notes?: string
}
```

### Promotion Service

```typescript
// promotions/promotions.service.ts

@Injectable()
export class PromotionsService {
  constructor(private prisma: PrismaService) {}

  async getActivePromotionsForListing(listingId: string): Promise<Promotion[]> {
    return this.prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: new Date() },
        endDate:   { gte: new Date() },
        listings: {
          some: { listingId },
        },
      },
    })
  }

  // Applied when returning listing detail — compute effective price
  applyPromotion(
    basePrice: number,
    promotion: Promotion | null,
  ): { effectivePrice: number; saving: number } {
    if (!promotion) return { effectivePrice: basePrice, saving: 0 }

    if (promotion.discountPercent) {
      const saving = basePrice * (promotion.discountPercent / 100)
      return { effectivePrice: basePrice - saving, saving }
    }

    if (promotion.discountAmountUsd) {
      return {
        effectivePrice: basePrice - promotion.discountAmountUsd,
        saving: promotion.discountAmountUsd,
      }
    }

    return { effectivePrice: basePrice, saving: 0 }
  }

  // Cron: deactivate expired promotions
  @Cron('0 1 * * *')
  async deactivateExpired(): Promise<void> {
    await this.prisma.promotion.updateMany({
      where: {
        isActive: true,
        endDate: { lt: new Date() },
      },
      data: { isActive: false },
    })
  }
}
```

### Homepage Sections Powered by Promotions

These public endpoints return pre-filtered listing sets for the homepage. They are lightweight and can be cached.

| Endpoint | Logic |
|---|---|
| `GET /listings/featured` | `isFeatured = true AND status = PUBLISHED` |
| `GET /listings/hot-deals` | `isHotDeal = true AND status = PUBLISHED` |
| `GET /listings/new-arrivals` | `status = PUBLISHED ORDER BY publishedAt DESC LIMIT 12` |
| `GET /listings/local-stock` | `sellerType = UZA_RWANDA_STOCK AND status = PUBLISHED` |
| `GET /listings/recently-reduced` | Listings with active discount promotions |
| `GET /promotions/banners` | Active `HOMEPAGE_BANNER` promotions with placement metadata |

---

## Sustainability Engine

### When Metrics Are Recorded

Sustainability metrics are recorded automatically when an order reaches `DELIVERED` status. The `OrdersService` calls `SustainabilityService.recordDelivery()` inside the status advance handler.

No manual entry needed for standard orders.

```typescript
// sustainability/sustainability.service.ts

// CO2 and fuel saving estimates per vehicle category
const EMISSIONS_FACTORS = {
  PASSENGER_EV: {
    co2PerKmKg: 0.12,       // kg of CO2 avoided per km vs ICE average
    fuelSavedPerKmL: 0.07,  // liters of fuel saved per km
    annualKmEstimate: 20000, // assumed annual usage
  },
  TWO_THREE_WHEEL: {
    co2PerKmKg: 0.06,
    fuelSavedPerKmL: 0.035,
    annualKmEstimate: 15000,
  },
  COMMERCIAL_EV: {
    co2PerKmKg: 0.25,
    fuelSavedPerKmL: 0.15,
    annualKmEstimate: 40000,
  },
}

@Injectable()
export class SustainabilityService {
  constructor(private prisma: PrismaService) {}

  async recordDelivery(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        listing: {
          include: { category: true, evSpecs: true },
          },
        user: { include: { buyerProfile: true } },
      },
    })

    const categoryType = order.listing.category.type
    const factors      = EMISSIONS_FACTORS[categoryType] ?? EMISSIONS_FACTORS.PASSENGER_EV

    const annualKm    = factors.annualKmEstimate
    const co2Avoided  = annualKm * factors.co2PerKmKg
    const fuelSaved   = annualKm * factors.fuelSavedPerKmL

    await this.prisma.sustainabilityMetric.create({
      data: {
        listingId:             order.listingId,
        orderId:               order.id,
        vehicleType:           categoryType,
        buyerType:             order.user.buyerProfile?.buyerType,
        country:               order.deliveryCountry,
        estimatedCo2AvoidedKg: co2Avoided,
        estimatedFuelSavedL:   fuelSaved,
        greenKmSupported:      annualKm,
      },
    })
  }

  // Aggregate counters for homepage display
  async getPublicImpactCounters(): Promise<ImpactCounters> {
    const metrics = await this.prisma.sustainabilityMetric.aggregate({
      _sum: {
        estimatedCo2AvoidedKg: true,
        estimatedFuelSavedL:   true,
        greenKmSupported:      true,
      },
      _count: { id: true },
    })

    return {
      evsDelivered:      metrics._count.id,
      co2AvoidedKg:      metrics._sum.estimatedCo2AvoidedKg ?? 0,
      fuelSavedLitres:   metrics._sum.estimatedFuelSavedL   ?? 0,
      greenKmEnabled:    metrics._sum.greenKmSupported       ?? 0,
      treesEquivalent:   Math.floor((metrics._sum.estimatedCo2AvoidedKg ?? 0) / 21),
    }
  }
}
```

### Sustainability Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/sustainability/impact` | Public | Homepage impact counters |
| `GET` | `/admin/sustainability` | `SUSTAINABILITY_ADMIN` | Full impact dashboard |
| `GET` | `/admin/sustainability/by-buyer-type` | `SUSTAINABILITY_ADMIN` | Breakdown by buyer type |
| `GET` | `/admin/sustainability/by-country` | `SUSTAINABILITY_ADMIN` | Breakdown by country |
| `GET` | `/admin/sustainability/by-vehicle-type` | `SUSTAINABILITY_ADMIN` | Breakdown by vehicle type |
| `GET` | `/admin/sustainability/fleet/:clientName` | `SUSTAINABILITY_ADMIN` | Per fleet client report |

### Impact Filter DTO

```typescript
// dto/filter-impact.dto.ts

export class FilterImpactDto {
  @IsOptional() @IsString() country?: string
  @IsOptional() @IsEnum(BuyerType) buyerType?: BuyerType
  @IsOptional() @IsString() vehicleType?: string
  @IsOptional() @IsString() fleetClientName?: string
  @IsOptional() @IsDateString() from?: string
  @IsOptional() @IsDateString() to?: string
}
```

---

## Financing Facilitation

### Important Positioning

The platform facilitates financing, it does not provide financing. The language used in APIs and responses must reflect this:

- `"Financing support available upon request"` ✓
- `"Uza Mobility may help qualified clients prepare documents for financial institutions"` ✓
- `"Get instant financing"` ✗
- `"Buy on credit"` ✗

### Financing Request Flow

```
Buyer clicks "Request Financing Support" on a listing
→ POST /financing/request
→ Minimal form: name, phone, buyer type, invoice number, preferred deposit
→ FinancingRequest created (status: SUBMITTED)
→ Finance admin reviews
→ Admin optionally assigns a bank partner
→ Status → SENT_TO_BANK
→ Bank reviews independently
→ Admin records outcome → BANK_APPROVED or BANK_REJECTED
→ Buyer notified
```

### Financing Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/financing/request` | JWT (BUYER) | Submit financing request |
| `GET` | `/financing/my` | JWT (BUYER) | Own financing requests |
| `GET` | `/admin/financing` | `FINANCE_ADMIN` | All requests with filters |
| `GET` | `/admin/financing/:id` | `FINANCE_ADMIN` | Request detail |
| `PATCH` | `/admin/financing/:id/assign-bank` | `financing:send-to-bank` | Assign bank and advance status |
| `PATCH` | `/admin/financing/:id/outcome` | `financing:send-to-bank` | Record bank decision |

### Financing Request DTO

```typescript
// dto/create-financing-request.dto.ts

export class CreateFinancingRequestDto {
  @IsString() buyerName: string
  @IsString() phone: string
  @IsOptional() @IsEnum(BuyerType) buyerType?: BuyerType
  @IsOptional() @IsString() invoiceId?: string
  @IsOptional() @IsString() listingId?: string  // if no invoice yet
  @IsOptional() @IsNumber() @Min(0) preferredDepositUsd?: number
  @IsOptional() @IsString() preferredBankName?: string
  @IsOptional() @IsString() employmentStatus?: string
  @IsOptional() @IsString() organizationName?: string
  @IsOptional() @IsString() notes?: string
}
```

### Financing Service

```typescript
// financing/financing.service.ts

async submitRequest(
  userId: string,
  dto: CreateFinancingRequestDto,
): Promise<FinancingRequest> {
  // Validate: invoice must belong to this user if provided
  if (dto.invoiceId) {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: dto.invoiceId },
    })
    if (invoice.userId !== userId) {
      throw new ForbiddenException('Invoice does not belong to this user')
    }
  }

  const request = await this.prisma.financingRequest.create({
    data: { userId, ...dto },
  })

  await this.notificationsService.sendToAdmins({
    type: 'SYSTEM_ALERT',
    title: 'New financing request',
    body: `${dto.buyerName} has requested financing support.`,
    metadata: { requestId: request.id },
  })

  return request
}

async assignBank(
  requestId: string,
  bankId: string,
  adminId: string,
): Promise<void> {
  await this.prisma.$transaction([
    this.prisma.financingRequest.update({
      where: { id: requestId },
      data: {
        assignedBankId: bankId,
        status: 'SENT_TO_BANK',
      },
    }),
    this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'financing:sent-to-bank',
        entity: 'FinancingRequest',
        entityId: requestId,
        metadata: { bankId },
      },
    }),
  ])
}
```

---

## Admin Dashboard

### Dashboard Overview Endpoint

Returns a snapshot of key metrics for the super admin landing page. All counts are computed in a single batched Prisma query to keep it fast.

```typescript
// admin/dashboard.service.ts

async getOverview(): Promise<DashboardOverview> {
  const [
    totalListings,
    pendingListings,
    totalOrders,
    pendingPayments,
    activeFleetRequests,
    pendingFinancing,
    impactCounters,
  ] = await Promise.all([
    this.prisma.listing.count({ where: { status: 'PUBLISHED' } }),
    this.prisma.listing.count({ where: { status: 'PENDING_REVIEW' } }),
    this.prisma.order.count(),
    this.prisma.payment.count({ where: { status: 'SUBMITTED' } }),
    this.prisma.fleetRequest.count({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'QUOTED'] } },
    }),
    this.prisma.financingRequest.count({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
    }),
    this.sustainabilityService.getPublicImpactCounters(),
  ])

  return {
    listings: { total: totalListings, pendingReview: pendingListings },
    orders: { total: totalOrders },
    payments: { pendingVerification: pendingPayments },
    fleet: { active: activeFleetRequests },
    financing: { pending: pendingFinancing },
    impact: impactCounters,
  }
}
```

### Admin Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/admin/dashboard` | `SUPER_ADMIN` | Full overview metrics |
| `GET` | `/admin/activity-logs` | `SUPER_ADMIN` | Full audit log with filters |
| `GET` | `/admin/users` | `SUPER_ADMIN` | All users |
| `PATCH` | `/admin/users/:id/roles` | `users:manage-roles` | Assign/remove roles |
| `PATCH` | `/admin/users/:id/deactivate` | `SUPER_ADMIN` | Deactivate user |
| `GET` | `/admin/sellers` | `MARKETPLACE_ADMIN` | All sellers |
| `PATCH` | `/admin/sellers/:id/verify` | `sellers:verify` | Verify seller |
| `PATCH` | `/admin/sellers/:id/suspend` | `sellers:suspend` | Suspend seller |
| `GET` | `/admin/banks` | `FINANCE_ADMIN` | List bank partners |
| `POST` | `/admin/banks` | `SUPER_ADMIN` | Add bank partner |

### Activity Log Filtering

The activity log is the platform's audit trail. Finance admins and super admins use it for reconciliation and compliance.

```typescript
export class FilterActivityLogsDto {
  @IsOptional() @IsString() userId?: string
  @IsOptional() @IsString() action?: string      // e.g. 'payments:confirmed'
  @IsOptional() @IsString() entity?: string      // e.g. 'Invoice'
  @IsOptional() @IsString() entityId?: string
  @IsOptional() @IsDateString() from?: string
  @IsOptional() @IsDateString() to?: string
  @IsOptional() @IsInt() page?: number
  @IsOptional() @IsInt() limit?: number
}
```

---

## Global Interceptors and Guards

These apply platform-wide and are configured in `AppModule`.

```typescript
// app.module.ts

providers: [
  // Strip null/undefined from all responses
  { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },

  // Log all requests and responses
  { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },

  // Catch all unhandled exceptions, return consistent error format
  { provide: APP_FILTER, useClass: GlobalExceptionFilter },

  // Validate all DTOs globally
  { provide: APP_PIPE, useValue: new ValidationPipe({
    whitelist: true,           // strip unknown fields
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  })},
]
```

### Standard Response Format

Every API response follows this shape:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {           // pagination, only on list endpoints
    "total": 248,
    "page": 1,
    "limit": 24,
    "totalPages": 11
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "PAYMENT_NOT_FOUND",
    "message": "Payment with id xyz was not found",
    "statusCode": 404
  }
}
```

---

## Key Business Rules

**Promotions**
- A promotion with `discountPercent` or `discountAmountUsd` modifies the **displayed** price on the frontend. The `ListingPricing.finalPriceUsd` in the database does not change. The invoice always reflects the actual selling price — the promotion saving is shown as a line item.
- Sponsored/banner promotions (`HOMEPAGE_BANNER`, `CATEGORY_SPONSORSHIP`) do not affect pricing. They only control placement.
- An admin can attach a listing to multiple promotions, but only one active discount promotion should apply at a time. If multiple discount promotions overlap, the system applies the one with the highest saving.

**Sustainability**
- Emission factors are stored as constants in the service for MVP. In Phase 4, these should move to an admin-configurable table so they can be updated without code changes.
- The `treesEquivalent` counter uses the standard 21kg CO2 per tree per year estimate. Disclose the calculation methodology in the public display.
- Sustainability data is append-only. Never delete or update `sustainability_metrics` records — only add corrections as new entries.

**Financing**
- The platform must never store or display bank account details of the buyer. Only the buyer's contact info and self-reported employment/business status.
- Financing requests are visible to `FINANCE_ADMIN` only. `SALES_AGENT` cannot see them.
- If a financing request is rejected by a bank and the buyer wants to try another bank, they submit a new request — do not reuse or reopen the old one.

**Admin**
- The `SUPER_ADMIN` role is the only role that can assign other roles. A `MARKETPLACE_ADMIN` cannot elevate someone to `FINANCE_ADMIN`.
- All admin actions on sensitive records (payment confirmation, listing approval, role changes) must write to `activity_logs` inside the same database transaction. If the log write fails, the whole action rolls back.
- The admin dashboard overview endpoint should be cached for 60 seconds in Redis to avoid hammering the database on every page load.
