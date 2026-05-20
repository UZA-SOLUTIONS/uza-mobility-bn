# DOC 04 — Orders, Fleet, Parts & Energy
**Uza Mobility · NestJS Backend**

---

## Overview

This doc covers four interconnected modules. Orders and tracking handle what happens after payment is confirmed. Fleet handles B2B and institutional bulk requests. Parts covers the spare parts marketplace. Energy covers charging and infrastructure products and quote requests.

---

## Module Breakdown

```
src/modules/
├── orders/
│   ├── orders.module.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   └── dto/
│       └── update-order-status.dto.ts
│
├── fleet/
│   ├── fleet.module.ts
│   ├── fleet.controller.ts
│   ├── fleet.service.ts
│   └── dto/
│       ├── create-fleet-request.dto.ts
│       └── update-fleet-request.dto.ts
│
├── parts/
│   ├── parts.module.ts
│   ├── parts.controller.ts
│   ├── parts.service.ts
│   └── dto/
│       └── create-part.dto.ts
│
└── energy/
    ├── energy.module.ts
    ├── energy.controller.ts
    ├── energy.service.ts
    └── dto/
        ├── create-charging-product.dto.ts
        └── create-energy-request.dto.ts
```

---

## Orders & Tracking

### Order Creation

Orders are never created manually. They are created automatically when a payment is confirmed. The `PaymentsService` calls `OrdersService.createFromInvoice()` after confirming payment.

```typescript
// orders/orders.service.ts

async createFromInvoice(invoiceId: string): Promise<Order> {
  const invoice = await this.prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { listing: true, user: true },
  })

  const orderNumber = await this.generateOrderNumber()

  const order = await this.prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        userId: invoice.userId,
        listingId: invoice.listingId,
        invoiceId: invoice.id,
        status: 'PAYMENT_CONFIRMED',
        sellerType: invoice.sellerType,
      },
    })

    // Add first tracking event
    await tx.orderTrackingEvent.create({
      data: {
        orderId: newOrder.id,
        stage: 'PAYMENT_CONFIRMED',
        title: 'Payment Confirmed',
        description: 'Your payment has been verified. Your order is now being processed.',
      },
    })

    return newOrder
  })

  // Notify buyer
  await this.notificationsService.send({
    userId: invoice.userId,
    type: 'ORDER_STATUS_UPDATED',
    title: 'Order created',
    body: `Order ${orderNumber} has been created. We will keep you updated.`,
    metadata: { orderId: order.id },
  })

  return order
}
```

### Tracking Stages Per Seller Type

Each seller type has its own set of tracking stages. When an admin advances an order, the system validates the transition based on the order's `sellerType`.

```typescript
// orders/order-stages.ts

export const ORDER_STAGES: Record<SellerType, OrderStatus[]> = {
  UZA_RWANDA_STOCK: [
    'INVOICE_ISSUED',
    'PAYMENT_SUBMITTED',
    'PAYMENT_CONFIRMED',
    'VEHICLE_RESERVED',
    'READY_FOR_HANDOVER',
    'DELIVERED',
  ],

  LOCAL_SELLER: [
    'INVOICE_ISSUED',
    'PAYMENT_SUBMITTED',
    'PAYMENT_CONFIRMED',
    'VEHICLE_RESERVED',
    'PROCESSING',       // seller notified, inspection arranged
    'READY_FOR_HANDOVER',
    'DELIVERED',
  ],

  UZA_CHINA_SOURCING: [
    'INVOICE_ISSUED',
    'PAYMENT_SUBMITTED',
    'PAYMENT_CONFIRMED',
    'VEHICLE_RESERVED',
    'PROCESSING',       // vehicle reserved abroad
    'IN_TRANSIT',       // shipping arranged, on the way
    'ARRIVED',          // arrived at destination port
    'CLEARANCE',        // customs clearance in progress
    'READY_FOR_HANDOVER',
    'DELIVERED',
  ],

  INTERNATIONAL_SELLER: [
    'INVOICE_ISSUED',
    'PAYMENT_SUBMITTED',
    'PAYMENT_CONFIRMED',
    'VEHICLE_RESERVED',
    'PROCESSING',
    'IN_TRANSIT',
    'ARRIVED',
    'CLEARANCE',
    'READY_FOR_HANDOVER',
    'DELIVERED',
  ],
}

// Human-readable labels for each stage
export const STAGE_LABELS: Record<OrderStatus, string> = {
  INVOICE_ISSUED:      'Invoice Issued',
  PAYMENT_SUBMITTED:   'Payment Submitted',
  PAYMENT_CONFIRMED:   'Payment Confirmed',
  VEHICLE_RESERVED:    'Vehicle Reserved',
  PROCESSING:          'Processing',
  IN_TRANSIT:          'In Transit',
  ARRIVED:             'Arrived',
  CLEARANCE:           'Customs Clearance',
  READY_FOR_HANDOVER:  'Ready for Handover',
  DELIVERED:           'Delivered',
  CANCELLED:           'Cancelled',
}
```

### Advancing Order Status

Only `LOGISTICS_ADMIN` or `SUPER_ADMIN` can advance order status. Each advance appends a new `OrderTrackingEvent`.

```typescript
async advanceOrderStatus(
  orderId: string,
  dto: UpdateOrderStatusDto,
  adminId: string,
): Promise<void> {
  const order = await this.prisma.order.findUniqueOrThrow({
    where: { id: orderId },
  })

  const stages  = ORDER_STAGES[order.sellerType]
  const current = stages.indexOf(order.status)
  const next    = stages[current + 1]

  if (!next) {
    throw new BadRequestException('Order is already at final stage')
  }

  await this.prisma.$transaction([
    this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: next,
        actualDeliveryDate: next === 'DELIVERED' ? new Date() : undefined,
      },
    }),

    this.prisma.orderTrackingEvent.create({
      data: {
        orderId,
        stage: next,
        title: STAGE_LABELS[next],
        description: dto.description,
        location: dto.location,
        performedBy: adminId,
      },
    }),

    this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'orders:status-updated',
        entity: 'Order',
        entityId: orderId,
        metadata: { from: order.status, to: next },
      },
    }),
  ])

  // Trigger sustainability metric on delivery
  if (next === 'DELIVERED') {
    await this.sustainabilityService.recordDelivery(orderId)
  }

  await this.notificationsService.send({
    userId: order.userId,
    type: 'ORDER_STATUS_UPDATED',
    title: STAGE_LABELS[next],
    body: dto.description ?? `Your order status has been updated to: ${STAGE_LABELS[next]}`,
    metadata: { orderId, status: next },
  })
}
```

### Order Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/orders/my` | `BUYER` | Own orders with tracking events |
| `GET` | `/orders/:id/tracking` | `BUYER` (owner) | Full tracking timeline |
| `GET` | `/admin/orders` | `LOGISTICS_ADMIN` | All orders with filters |
| `GET` | `/admin/orders/:id` | `LOGISTICS_ADMIN` | Order detail with full tracking |
| `PATCH` | `/admin/orders/:id/advance` | `orders:update-status` | Advance to next stage |
| `PATCH` | `/admin/orders/:id/cancel` | `SUPER_ADMIN` | Cancel order |

---

## Fleet Module

### Fleet Request Flow

```
Organization submits fleet request form
→ POST /fleet/request
→ FleetRequest created (status: SUBMITTED)
→ Fleet admin receives notification
→ Admin reviews, contacts org
→ Admin updates status → QUOTED (attaches invoice if bulk)
→ Fleet process continues like individual order
```

### Fleet Request DTO

```typescript
// dto/create-fleet-request.dto.ts

export class CreateFleetRequestDto {
  @IsString() organizationName: string
  @IsString() contactPerson: string
  @IsString() phone: string
  @IsOptional() @IsEmail() email?: string
  @IsEnum(BuyerType) buyerType: BuyerType

  @IsOptional() @IsString() vehicleCategoryId?: string
  @IsOptional() @IsString() vehicleSubcategoryId?: string

  @IsInt() @Min(1) quantity: number
  @IsOptional() @IsEnum(UseCase) useCase?: UseCase
  @IsOptional() @IsString() preferredDeliveryTimeline?: string
  @IsOptional() @IsNumber() budgetRangeMin?: number
  @IsOptional() @IsNumber() budgetRangeMax?: number
  @IsBoolean() @IsOptional() financingRequested?: boolean
  @IsBoolean() @IsOptional() chargingSupportRequested?: boolean
  @IsOptional() @IsString() associationId?: string
  @IsOptional() @IsString() notes?: string
}
```

### Fleet Status Machine

```typescript
const FLEET_TRANSITIONS = {
  SUBMITTED:   ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['QUOTED', 'CANCELLED'],
  QUOTED:      ['APPROVED', 'CANCELLED'],
  APPROVED:    ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
}
```

### Fleet Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/fleet/request` | Public (or JWT optional) | Submit fleet request |
| `GET` | `/fleet/my` | JWT | Own fleet requests |
| `GET` | `/admin/fleet` | `FLEET_ADMIN` | All fleet requests |
| `GET` | `/admin/fleet/:id` | `FLEET_ADMIN` | Fleet request detail |
| `PATCH` | `/admin/fleet/:id/status` | `fleet:update-status` | Advance fleet status |
| `POST` | `/admin/fleet/associations` | `FLEET_ADMIN` | Create association |
| `GET` | `/admin/fleet/associations` | `FLEET_ADMIN` | List associations |
| `POST` | `/admin/fleet/associations/:id/members` | `FLEET_ADMIN` | Add member to association |

### Association Onboarding

Associations (e.g. taxi cooperatives) are created by fleet admins. Individual members link to the association. When a member submits a vehicle order, the fleet admin can see it grouped under the association.

```typescript
async onboardAssociation(dto: CreateAssociationDto): Promise<Association> {
  return this.prisma.association.create({
    data: {
      name: dto.name,
      type: dto.type,
      country: dto.country,
      city: dto.city,
      contactPerson: dto.contactPerson,
      phone: dto.phone,
      email: dto.email,
    },
  })
}
```

---

## Parts Module

### Parts are listed by sellers or by UZA directly. Parts do not go through the same approval flow as vehicle listings — a simpler admin review is enough.

### Part Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/parts` | Public | Browse parts with filters |
| `GET` | `/parts/:id` | Public | Part detail |
| `POST` | `/parts` | `SELLER` | List a new part |
| `PATCH` | `/parts/:id` | `SELLER` (owner) | Update own part |
| `DELETE` | `/parts/:id` | `SELLER` (owner) | Remove listing |
| `GET` | `/admin/parts` | `MARKETPLACE_ADMIN` | All parts |
| `PATCH` | `/admin/parts/:id/activate` | `MARKETPLACE_ADMIN` | Activate part listing |
| `PATCH` | `/admin/parts/:id/deactivate` | `MARKETPLACE_ADMIN` | Deactivate |

### Create Part DTO

```typescript
// dto/create-part.dto.ts

export class CreatePartDto {
  @IsString() name: string
  @IsString() categorySlug: string   // 'batteries', 'motors', 'chargers', etc.
  @IsArray() @IsString({ each: true }) @IsOptional()
  compatibleBrands?: string[]
  @IsArray() @IsString({ each: true }) @IsOptional()
  compatibleModels?: string[]
  @IsEnum(PartCondition) condition: PartCondition
  @IsNumber() @Min(0) priceUsd: number
  @IsInt() @Min(0) stockQuantity: number
  @IsOptional() @IsString() deliveryEstimate?: string
  @IsBoolean() @IsOptional() hasWarranty?: boolean
  @IsOptional() @IsString() warrantyDetails?: string
  @IsOptional() @IsString() description?: string
}
```

### Parts Filter

Parts support simpler filtering than vehicle listings:

```typescript
export class FilterPartsDto {
  @IsOptional() @IsString() q?: string
  @IsOptional() @IsString() category?: string
  @IsOptional() @IsString() brand?: string          // compatible brand
  @IsOptional() @IsString() model?: string          // compatible model
  @IsOptional() @IsEnum(PartCondition) condition?: PartCondition
  @IsOptional() @IsNumber() priceMin?: number
  @IsOptional() @IsNumber() priceMax?: number
  @IsOptional() @IsBoolean() inStock?: boolean
  @IsOptional() @IsInt() page?: number
  @IsOptional() @IsInt() limit?: number
}
```

Parts filter by `compatibleBrands` and `compatibleModels` using Postgres array contains:

```typescript
if (filters.brand) {
  where.compatibleBrands = { has: filters.brand }
}
if (filters.model) {
  where.compatibleModels = { has: filters.model }
}
if (filters.inStock) {
  where.stockQuantity = { gt: 0 }
}
```

---

## Energy Module

### Energy products are managed by admins. Public users browse products and submit requests for quotes or site visits.

### Charging Product Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/energy/products` | Public | Browse charging products |
| `GET` | `/energy/products/:id` | Public | Product detail |
| `POST` | `/admin/energy/products` | `MARKETPLACE_ADMIN` | Create charging product |
| `PATCH` | `/admin/energy/products/:id` | `MARKETPLACE_ADMIN` | Update product |

### Energy Request Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/energy/request` | Public (JWT optional) | Submit energy/charging request |
| `GET` | `/admin/energy/requests` | `FLEET_ADMIN` | All energy requests |
| `PATCH` | `/admin/energy/requests/:id/status` | `FLEET_ADMIN` | Update request status |

### Energy Request DTO

```typescript
// dto/create-energy-request.dto.ts

export class CreateEnergyRequestDto {
  @IsString() contactName: string
  @IsString() phone: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsEnum(BuyerType) clientType?: BuyerType
  @IsOptional() @IsString() location?: string
  @IsOptional() @IsString() city?: string
  @IsOptional() @IsInt() numberOfEvs?: number
  @IsOptional() @IsEnum(ChargingProductType) chargerTypeNeeded?: ChargingProductType
  @IsBoolean() @IsOptional() solarSupportNeeded?: boolean
  @IsBoolean() @IsOptional() fleetUse?: boolean
  @IsBoolean() @IsOptional() siteVisitRequested?: boolean
  @IsOptional() @IsString() chargingProductId?: string
  @IsOptional() @IsString() notes?: string
}
```

---

## Key Business Rules

**Orders**
- Orders are created automatically on payment confirmation. Never manually.
- The `DELIVERED` status triggers the sustainability metric recording automatically.
- For local seller orders, the seller payout is only processed after `DELIVERED` status. This prevents releasing funds before handover is confirmed.
- An order can only be cancelled by `SUPER_ADMIN`. Cancellation does not automatically refund — that is a separate manual payment action.

**Fleet**
- Fleet requests from public users do not require authentication. A phone number is enough to start. Authentication can be added when the fleet dashboard is built in phase 3.
- Bulk fleet invoices are created manually by fleet admins in the admin panel, not through the standard invoice request flow.

**Parts**
- Parts stock quantity must be decremented when an invoice is confirmed for a part. This requires a parts-specific payment flow (simpler than the vehicle flow — no reservation stage needed, just order and deliver).
- Parts listed with `stockQuantity = 0` are shown as "Out of Stock" publicly but remain visible.

**Energy**
- Energy requests are not tied to payments directly. They are quote requests that the UZA team follows up on manually. In Phase 3, energy products can get their own invoice flow.
- Charging products listed under `/energy/products` can also appear in the main marketplace under the `EV_INFRASTRUCTURE_ENERGY` category — they share the same data, just different display contexts.
