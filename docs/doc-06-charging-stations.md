# DOC 06 — Charging Stations
**Uza Mobility · Feature Planning Document**

---

## What This Feature Is

A charging station is a physical location that offers EV charging services to the public or to a specific group of users. This feature allows charging station operators to register on the platform, submit their station details through a dashboard, and get approved by the UZA admin team before their station appears publicly.

On the public side, users browse, search, and filter nearby stations. This connects directly to the EV ownership experience — a user who bought a vehicle through Uza Mobility should be able to find where to charge it.

This feature sits under the **Uza Mobility Energy** pillar already defined in the platform spec.

---

## New Actor: Charging Station Operator

The platform currently has these actor types: Buyer, Seller, Admin roles. This feature introduces a new one.

A **Charging Station Operator** is a person or organisation that owns or manages one or more physical charging stations. They register on the platform, fill in their station details, and wait for admin approval.

They are not a vehicle seller. They should not share the Seller role. They get their own role: `CHARGING_OPERATOR`.

One operator can manage multiple stations. This is important — a company like a fuel station chain, hotel group, or energy provider may register once and list several locations.

---

## How It Fits the Existing Architecture

### Role & Permissions

Add to the existing roles table:

| Role | Description |
|---|---|
| `CHARGING_OPERATOR` | Registers and manages own charging stations |

Add to the permissions table:

```
stations:create
stations:update
stations:submit
stations:read-own
```

Admin permissions already in the system that apply here:

```
stations:approve     → MARKETPLACE_ADMIN
stations:reject      → MARKETPLACE_ADMIN
stations:suspend     → MARKETPLACE_ADMIN
stations:read-all    → MARKETPLACE_ADMIN, SUPER_ADMIN
```

### User Flow — Operator Side

```
User registers normally (existing auth flow)
→ User applies to become a charging operator
→ OperatorProfile created (status: PENDING)
→ Admin reviews operator application
→ Admin approves → user gets CHARGING_OPERATOR role
→ Operator accesses station dashboard
→ Operator registers one or more stations (status: DRAFT)
→ Operator fills station details and submits for review
→ Admin reviews station
→ Admin approves → station goes ACTIVE and appears publicly
```

The operator application step mirrors how sellers work in the existing system — a user applies, admin approves, role is assigned.

### Existing Tables This Feature Touches

- `users` — operator links to a user account
- `user_roles` — CHARGING_OPERATOR role added on approval
- `activity_logs` — all admin actions logged here as already established
- `notifications` — operator notified on approval or rejection

---

## New Database Tables

### operator_profiles

Stores the business information of the charging station operator.

| Field | Type | Notes |
|---|---|---|
| id | cuid | Primary key |
| userId | string | FK → users |
| businessName | string | Organisation or individual name |
| businessRegNumber | string? | Optional registration number |
| contactPerson | string | |
| phone | string | |
| email | string | |
| country | string | |
| city | string | |
| address | string? | |
| logoUrl | string? | |
| description | string? | |
| status | enum | PENDING, ACTIVE, SUSPENDED, REJECTED |
| isVerified | boolean | Admin-verified operator |
| verifiedAt | datetime? | |
| adminNotes | string? | Internal only |
| createdAt | datetime | |
| updatedAt | datetime | |

---

### charging_stations

Each row is one physical charging location. One operator can have many.

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| operatorId | string | FK → operator_profiles |
| name | string | Station display name |
| slug | string | Unique, URL-safe |
| status | enum | DRAFT, PENDING_REVIEW, APPROVED, ACTIVE, SUSPENDED, REJECTED, CLOSED |
| description | string? | |
| address | string | Full physical address |
| city | string | |
| country | string | |
| latitude | float | For map display and proximity search |
| longitude | float | For map display and proximity search |
| locationType | enum | PUBLIC, PRIVATE, SEMI_PUBLIC, FLEET_ONLY |
| isOpen24h | boolean | |
| openingHours | json? | Per-day hours if not 24h |
| totalPorts | int | Total number of charging ports |
| availablePorts | int? | Real-time available ports, updated via API or manual |
| hasParking | boolean | |
| hasWifi | boolean | |
| hasRestroom | boolean | |
| hasCCTV | boolean | |
| hasRoofCover | boolean | |
| photos | relation | |
| operationalStatus | enum | OPERATIONAL, PARTIALLY_OPERATIONAL, OFFLINE, MAINTENANCE |
| adminNotes | string? | Internal only |
| publishedAt | datetime? | |
| createdAt | datetime | |
| updatedAt | datetime | |

---

### charging_ports

Each station has one or more individual charging ports. This is the level at which charger type, speed, and compatibility live.

Separating ports from stations matters because a single station can have 2 fast DC chargers and 4 slow AC chargers simultaneously.

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| stationId | string | FK → charging_stations |
| portNumber | string? | e.g. "Port A1", "Bay 3" |
| chargerType | enum | AC_TYPE2, DC_CCS, DC_CHADEMO, DC_GBDC, AC_TYPE1, TESLA_WALL |
| speedCategory | enum | SLOW, FAST, RAPID, ULTRA_RAPID |
| powerKw | float | e.g. 7.4, 22, 50, 150, 350 |
| voltage | int? | V |
| amperage | int? | A |
| currentType | enum | AC, DC |
| status | enum | AVAILABLE, IN_USE, FAULTED, OUT_OF_SERVICE |
| isActive | boolean | |
| createdAt | datetime | |
| updatedAt | datetime | |

---

### station_pricing

Pricing per station. Operators set their own rates.

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| stationId | string | FK → charging_stations |
| pricingModel | enum | PER_KWH, PER_MINUTE, PER_SESSION, FREE |
| rateAmount | float? | |
| currency | string | Default USD |
| notes | string? | e.g. "First 30 min free" |
| isActive | boolean | |
| validFrom | datetime | |
| validUntil | datetime? | |

---

### vehicle_compatibility

Which vehicle types or specific models are confirmed compatible at this station. Operators tag compatibility themselves and admins can verify it.

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| stationId | string | FK → charging_stations |
| vehicleCategory | enum | PASSENGER_EV, TWO_THREE_WHEEL, COMMERCIAL_EV |
| brand | string? | Specific brand if known |
| model | string? | Specific model if known |
| isVerified | boolean | Admin or operator confirmed |

---

### station_photos

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| stationId | string | FK → charging_stations |
| url | string | |
| isPrimary | boolean | |
| displayOrder | int | |
| uploadedAt | datetime | |

---

### station_reviews (Phase 2)

User reviews of stations. Not in Phase 1 but the table should be in the schema from the start.

| Field | Type | Notes |
|---|---|---|
| id | cuid | |
| stationId | string | |
| userId | string | |
| rating | int | 1–5 |
| comment | string? | |
| createdAt | datetime | |

---

## Module Structure

```
src/modules/
└── charging-stations/
    ├── charging-stations.module.ts
    ├── operators.controller.ts        // operator self-service
    ├── operators.service.ts
    ├── stations.controller.ts         // public browse + operator CRUD
    ├── stations.service.ts
    ├── stations-search.service.ts     // location + filter logic
    ├── admin-stations.controller.ts   // admin review and approval
    └── dto/
        ├── create-operator-profile.dto.ts
        ├── create-station.dto.ts
        ├── create-charging-port.dto.ts
        ├── create-station-pricing.dto.ts
        ├── filter-stations.dto.ts
        └── update-station-status.dto.ts
```

---

## Station Lifecycle

Same pattern as listings. Enforce with a state machine.

```
DRAFT → PENDING_REVIEW → APPROVED → ACTIVE
                       ↘ REJECTED

ACTIVE → SUSPENDED   (admin action)
ACTIVE → CLOSED      (operator closes permanently)
REJECTED → DRAFT     (operator fixes and resubmits)
SUSPENDED → ACTIVE   (admin reinstates)
```

A station is only visible publicly when status is `ACTIVE` and `operationalStatus` is not `OFFLINE`.

---

## Operator Registration Flow in Detail

### Step 1 — Apply as operator

Any authenticated user can apply. Creates an `OperatorProfile` with status `PENDING`.

```
POST /charging-stations/operators/apply
Body: { businessName, contactPerson, phone, email, country, city, description? }
Guard: JWT (any logged-in user)
```

### Step 2 — Admin reviews operator application

```
GET  /admin/charging-stations/operators           // list pending
PATCH /admin/charging-stations/operators/:id/approve
PATCH /admin/charging-stations/operators/:id/reject
```

On approval:
- `OperatorProfile.status` → ACTIVE
- `UserRole` record created: userId + CHARGING_OPERATOR role
- Operator notified

### Step 3 — Operator registers a station

```
POST /charging-stations/stations
Guard: JWT + CHARGING_OPERATOR role
```

Station created with status `DRAFT` linked to the operator's profile.

### Step 4 — Operator fills station details

```
PATCH /charging-stations/stations/:id              // update details
POST  /charging-stations/stations/:id/ports        // add charging ports
POST  /charging-stations/stations/:id/pricing      // set pricing
POST  /charging-stations/stations/:id/photos       // upload photos
POST  /charging-stations/stations/:id/compatibility // add vehicle compatibility tags
```

### Step 5 — Operator submits for review

```
POST /charging-stations/stations/:id/submit
Guard: JWT + CHARGING_OPERATOR (owner only)
```

Validates: station must have at least 1 port, 1 photo, and a valid address with coordinates before submission is allowed.

### Step 6 — Admin reviews and approves station

```
GET   /admin/charging-stations/stations            // list pending
PATCH /admin/charging-stations/stations/:id/approve
PATCH /admin/charging-stations/stations/:id/reject
PATCH /admin/charging-stations/stations/:id/suspend
```

On approval station moves to `ACTIVE` and appears in public search.

---

## Public Browse & Search

### Filter Fields

```typescript
export class FilterStationsDto {
  q?: string                    // keyword search on name, city, address
  country?: string
  city?: string
  latitude?: number             // for proximity search
  longitude?: number
  radiusKm?: number             // default 10km if lat/lng provided
  chargerType?: ChargerType     // AC_TYPE2, DC_CCS, etc.
  speedCategory?: SpeedCategory // SLOW, FAST, RAPID, ULTRA_RAPID
  powerKwMin?: number
  locationType?: LocationType   // PUBLIC, SEMI_PUBLIC, etc.
  vehicleCategory?: string      // filter by compatible vehicle category
  brand?: string                // filter by compatible brand
  pricingModel?: PricingModel   // PER_KWH, FREE, etc.
  isOpen24h?: boolean
  operationalStatus?: string
  hasParking?: boolean
  page?: number
  limit?: number
}
```

### Proximity Search

When `latitude`, `longitude`, and `radiusKm` are provided, use PostgreSQL's built-in distance calculation. No external service needed for MVP.

```typescript
// stations-search.service.ts

buildWhereClause(filters: FilterStationsDto): Prisma.ChargingStationWhereInput {
  const where: Prisma.ChargingStationWhereInput = {
    status: 'ACTIVE',
    operationalStatus: { not: 'OFFLINE' },
  }

  if (filters.city)    where.city    = { contains: filters.city, mode: 'insensitive' }
  if (filters.country) where.country = filters.country
  if (filters.isOpen24h !== undefined) where.isOpen24h = filters.isOpen24h

  if (filters.chargerType || filters.speedCategory || filters.powerKwMin) {
    where.ports = {
      some: {
        isActive: true,
        chargerType:   filters.chargerType   ?? undefined,
        speedCategory: filters.speedCategory ?? undefined,
        powerKw: filters.powerKwMin ? { gte: filters.powerKwMin } : undefined,
      }
    }
  }

  if (filters.vehicleCategory || filters.brand) {
    where.compatibleVehicles = {
      some: {
        vehicleCategory: filters.vehicleCategory ?? undefined,
        brand: filters.brand ? { equals: filters.brand, mode: 'insensitive' } : undefined,
      }
    }
  }

  return where
}
```

For proximity, use a raw query to compute distance using latitude and longitude columns:

```typescript
async findNearby(lat: number, lng: number, radiusKm: number) {
  return this.prisma.$queryRaw`
    SELECT *, (
      6371 * acos(
        cos(radians(${lat})) * cos(radians(latitude)) *
        cos(radians(longitude) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(latitude))
      )
    ) AS distance_km
    FROM charging_stations
    WHERE status = 'ACTIVE'
    HAVING distance_km <= ${radiusKm}
    ORDER BY distance_km ASC
  `
}
```

In a later phase, add a PostGIS extension or move to a dedicated geospatial index for better performance at scale.

---

## Public Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/charging-stations` | Public | Browse with filters |
| `GET` | `/charging-stations/nearby` | Public | Proximity search by lat/lng |
| `GET` | `/charging-stations/:slug` | Public | Station detail with ports, pricing, compatibility |
| `GET` | `/charging-stations/cities` | Public | List of cities that have active stations |

---

## Operator Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/charging-stations/operators/apply` | JWT | Apply as operator |
| `GET` | `/charging-stations/operators/me` | CHARGING_OPERATOR | Own operator profile |
| `PATCH` | `/charging-stations/operators/me` | CHARGING_OPERATOR | Update own profile |
| `GET` | `/charging-stations/stations/my` | CHARGING_OPERATOR | Own stations |
| `POST` | `/charging-stations/stations` | CHARGING_OPERATOR | Register new station |
| `PATCH` | `/charging-stations/stations/:id` | CHARGING_OPERATOR (owner) | Update station details |
| `POST` | `/charging-stations/stations/:id/submit` | CHARGING_OPERATOR (owner) | Submit for review |
| `POST` | `/charging-stations/stations/:id/ports` | CHARGING_OPERATOR (owner) | Add port |
| `PATCH` | `/charging-stations/stations/:id/ports/:portId` | CHARGING_OPERATOR (owner) | Update port |
| `DELETE` | `/charging-stations/stations/:id/ports/:portId` | CHARGING_OPERATOR (owner) | Remove port |
| `POST` | `/charging-stations/stations/:id/pricing` | CHARGING_OPERATOR (owner) | Set pricing |
| `POST` | `/charging-stations/stations/:id/photos` | CHARGING_OPERATOR (owner) | Upload photos |
| `POST` | `/charging-stations/stations/:id/compatibility` | CHARGING_OPERATOR (owner) | Add vehicle compatibility |

---

## Admin Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `GET` | `/admin/charging-stations/operators` | `MARKETPLACE_ADMIN` | All operator applications |
| `PATCH` | `/admin/charging-stations/operators/:id/approve` | `stations:approve` | Approve operator |
| `PATCH` | `/admin/charging-stations/operators/:id/reject` | `stations:reject` | Reject operator |
| `GET` | `/admin/charging-stations/stations` | `MARKETPLACE_ADMIN` | All stations by status |
| `PATCH` | `/admin/charging-stations/stations/:id/approve` | `stations:approve` | Approve station |
| `PATCH` | `/admin/charging-stations/stations/:id/reject` | `stations:reject` | Reject with reason |
| `PATCH` | `/admin/charging-stations/stations/:id/suspend` | `stations:suspend` | Suspend active station |

---

## Additions to Existing Tables

### Prisma Schema Additions

```prisma
// Add to the existing notification types enum
enum NotificationType {
  // ... existing values
  OPERATOR_APPLICATION_APPROVED
  OPERATOR_APPLICATION_REJECTED
  STATION_APPROVED
  STATION_REJECTED
  STATION_SUSPENDED
}

// Add to existing permissions seed
"stations:create"
"stations:update"
"stations:submit"
"stations:read-own"
"stations:approve"
"stations:reject"
"stations:suspend"
"stations:read-all"
```

---

## What Is Not in This Phase

These are valid future features but should not block the initial implementation:

- **Real-time port availability** — operators manually update available ports for now. Real-time requires a hardware API integration that varies per charger brand.
- **Booking or reservation** — users can browse and navigate to stations but cannot reserve a port through the platform yet.
- **Trip planning** — multi-stop charging route planner requires map SDK integration and is a Phase 4 feature.
- **User reviews of stations** — the table is in the schema but the endpoints are not built in Phase 1.
- **Payment through the platform for charging sessions** — out of scope until the platform has a payment gateway. Current payment flow is TT only.
- **PostGIS** — standard lat/lng math covers MVP needs. PostGIS can be added when station count grows or performance requires it.

---

## Key Business Rules

- An operator must be approved before they can register any station. A pending operator has no access to station endpoints.
- One user account can only have one operator profile.
- A station cannot be submitted for review without at least one port, one photo, and both latitude and longitude filled.
- `adminNotes` on both operator profiles and stations are never returned in public or operator-facing responses.
- A station's `operationalStatus` can be updated by the operator at any time without going through the review flow again — this covers day-to-day changes like maintenance mode.
- If an operator is suspended, all their stations are automatically suspended with them.
- Port status (AVAILABLE, IN_USE, FAULTED) is updated by the operator through the dashboard. It does not require admin review.
