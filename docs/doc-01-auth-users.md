# DOC 01 — Auth & Users
**Uza Mobility · NestJS Backend**

---

## Overview

This module handles everything related to identity: registration, login, token management, role assignment, and buyer profiles. Since you've already built this, this doc serves as a reference for how the rest of the system expects auth to behave and what it depends on.

---

## Module Breakdown

```
src/modules/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── jwt-refresh.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── permissions.guard.ts
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   ├── permissions.decorator.ts
│   │   └── current-user.decorator.ts
│   └── dto/
│       ├── register.dto.ts
│       ├── login.dto.ts
│       └── refresh-token.dto.ts
│
└── users/
    ├── users.module.ts
    ├── users.controller.ts
    ├── users.service.ts
    └── dto/
        ├── create-buyer-profile.dto.ts
        └── update-user.dto.ts
```

---

## Roles

These are the exact role names the system uses. Seed them into the `roles` table on first run.

| Role Name | Description |
|---|---|
| `SUPER_ADMIN` | Full access to everything |
| `MARKETPLACE_ADMIN` | Listings, sellers, categories, verification |
| `FINANCE_ADMIN` | Invoices, payments, financing requests |
| `LOGISTICS_ADMIN` | Order tracking, delivery, clearance |
| `FLEET_ADMIN` | Fleet requests, associations |
| `SUSTAINABILITY_ADMIN` | CO2 metrics, ESG reports |
| `ADVERTISING_ADMIN` | Promotions, banners, featured listings |
| `SALES_AGENT` | Assigned inquiries and client follow-up only |
| `SELLER` | Submit and manage own listings |
| `BUYER` | Browse, request invoices, track orders |

---

## Permissions

Permissions follow the pattern `resource:action`. Seed these alongside roles.

```
listings:create
listings:read
listings:approve
listings:reject
listings:feature
listings:delete

invoices:create
invoices:read
invoices:send
invoices:cancel

payments:submit
payments:verify
payments:reject
payments:refund

orders:read
orders:update-status

sellers:verify
sellers:suspend

fleet:read
fleet:update-status

financing:read
financing:send-to-bank

promotions:create
promotions:manage

sustainability:read
sustainability:manage

users:read
users:manage-roles
```

---

## Role → Permission Mapping

Seed this mapping. Each role gets a specific set of permissions.

```typescript
// seeds/roles-permissions.seed.ts

const rolePermissions = {
  SUPER_ADMIN: ['*'],  // all permissions

  MARKETPLACE_ADMIN: [
    'listings:create', 'listings:read', 'listings:approve',
    'listings:reject', 'listings:feature', 'listings:delete',
    'sellers:verify', 'sellers:suspend',
  ],

  FINANCE_ADMIN: [
    'invoices:read', 'invoices:send', 'invoices:cancel',
    'payments:verify', 'payments:reject', 'payments:refund',
    'financing:read', 'financing:send-to-bank',
  ],

  LOGISTICS_ADMIN: [
    'orders:read', 'orders:update-status',
  ],

  FLEET_ADMIN: [
    'fleet:read', 'fleet:update-status',
    'listings:read',
  ],

  SUSTAINABILITY_ADMIN: [
    'sustainability:read', 'sustainability:manage',
    'orders:read',
  ],

  ADVERTISING_ADMIN: [
    'promotions:create', 'promotions:manage',
    'listings:feature',
  ],

  SALES_AGENT: [
    'listings:read', 'orders:read',
  ],

  SELLER: [
    'listings:create', 'listings:read',
  ],

  BUYER: [
    'listings:read', 'invoices:create',
    'payments:submit', 'orders:read',
  ],
}
```

---

## Guards Usage Pattern

Two guards work together across the system:

```typescript
// Roles-only check
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FINANCE_ADMIN', 'SUPER_ADMIN')
@Patch(':id/confirm')
confirmPayment() {}

// Permission-level check (finer grained)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('listings:approve')
@Patch(':id/approve')
approveListing() {}

// Public route
@Public()
@Get()
getListings() {}
```

The `@Public()` decorator skips JWT entirely for browse/search routes.

---

## JWT Token Structure

The access token payload every other module reads via `@CurrentUser()`:

```typescript
interface JwtPayload {
  sub: string          // user id
  email: string
  roles: string[]      // ['FINANCE_ADMIN']
  permissions: string[] // ['payments:verify', 'invoices:read']
  iat: number
  exp: number
}
```

Permissions are embedded in the token at login time so the guard doesn't hit the database on every request.

---

## Auth Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register new user |
| `POST` | `/auth/login` | Public | Login, returns access + refresh tokens |
| `POST` | `/auth/refresh` | Refresh JWT | Get new access token |
| `POST` | `/auth/logout` | JWT | Invalidate refresh token |
| `GET` | `/auth/me` | JWT | Get current user with roles |

---

## Users Endpoints

| Method | Path | Guard | Description |
|---|---|---|---|
| `POST` | `/users/buyer-profile` | JWT | Create buyer profile |
| `GET` | `/users/buyer-profile` | JWT | Get own buyer profile |
| `PATCH` | `/users/buyer-profile` | JWT | Update buyer profile |
| `GET` | `/users` | SUPER_ADMIN | List all users |
| `PATCH` | `/users/:id/roles` | `users:manage-roles` | Assign roles to user |
| `PATCH` | `/users/:id/deactivate` | SUPER_ADMIN | Deactivate user |

---

## Key Behaviors Other Modules Depend On

**Seller creation** — when a user registers as a seller, the `sellers` module creates a `Seller` record linked to their `userId`. The user still keeps their `BUYER` role and gets the `SELLER` role added.

**Invoice ownership** — the `invoices` module always reads `request.user.sub` as the buyer's `userId`. This links every invoice to an authenticated user.

**Admin actions** — every admin endpoint stores `request.user.sub` as the `performedBy` or `verifiedBy` field in audit logs and payment/order records.

**Token refresh on role change** — if an admin changes a user's roles, the old access token still carries the old roles until expiry. For sensitive role changes (e.g. suspending a seller), force-invalidate all refresh tokens for that user.
