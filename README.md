# UZA Mobility platform

The trade backend: vehicles, listings, orders, invoices, payments, parts, sellers, financing,
charging-station commerce and inspections. **NestJS + Prisma + Postgres + MongoDB.**

**102 Prisma models · 22 migrations · 45 controllers · 219 endpoints.**

> ### Read this first: where the front ends are
>
> This repository is the API only. Two applications consume it, both live, and neither is
> in this repository:
>
> | | |
> |---|---|
> | **[`uza-mobility-fn`](https://github.com/UZA-SOLUTIONS/uza-mobility-fn)** | The customer site at **uzamobility.com** — marketing, vehicles, spare parts, the buyer account area, and the seller and charging-operator workspaces. Next.js |
> | **[`uza-mobility-admin`](https://github.com/UZA-SOLUTIONS/uza-mobility-admin)** | The staff panel — the `admin/*` route groups below. Next.js |
>
> An earlier revision of this file claimed the platform had no front end. **That was wrong**,
> and it was wrong because the author did not check the systems register in `uza-nexus`,
> which had both recorded. The claim is corrected here rather than quietly deleted, because
> anyone who read the old version made a decision on it.
>
> Coverage is genuinely incomplete, which is a different statement: the **lender** portals and
> the **workshop** portal are on `feat/lender-and-workshop-portals` in `uza-mobility-fn`, and
> the endpoints they call — `/financing/lenders/*` and `/workshop/*` — **do not exist in this
> repository yet.** Those screens are built and waiting. Writing those two controllers is the
> most valuable open work here.

---

## Running it, in five minutes

You need **Node 22+**, **npm** (not pnpm — this repo uses `package-lock.json`) and **Docker**.

```bash
npm ci
cp .env.example .env                   # then set DATABASE_URL and MONGODB_URI
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

- API → <http://localhost:7000>
- **Swagger → <http://localhost:7000/api/docs>** ← start here. It lists all 219 endpoints and
  cannot go stale

### It needs TWO databases

The thing most likely to waste your first hour.

| | | Why |
|---|---|---|
| **Postgres** | `DATABASE_URL` | Everything: 102 models |
| **MongoDB** | `MONGODB_URI` | **Uploads, via GridFS.** The API refuses to start without it |

The refusal is correct and deliberate, but the message — *"MONGODB_URI is required — uploads
are stored in MongoDB GridFS"* — is easy to miss in a wall of startup logs.

Fastest way to get both:

```bash
docker run -d --name uza-pg    -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=uza_mobility -p 5432:5432 postgres:16-alpine
docker run -d --name uza-mongo -p 27017:27017 mongo:7
```

`docker-compose.prod.yml` defines both with healthchecks and is a good reference.

### Useful scripts

```bash
npm run env:check        # which environment variables are missing
npm run db:check         # is the database reachable and migrated
npm run db:studio        # Prisma Studio — browse the data
npx tsc --noEmit         # typecheck; must be clean
```

---

## How the code is organised

```
src/
  main.ts                  boots on :7000, Swagger at /api/docs
  modules/                 22 modules, 45 controllers
    listings/              vehicles for sale — the core of the marketplace
    orders/  invoices/  payments/  commerce/
    parts/                 spare parts
    sellers/               third-party vendors and their subscriptions
    financing/  fleet/     loan applications, fleet requests
    charging-stations/     station DIRECTORY + selling piles. NOT OCPP — see below
    energy/  bookings/  inquiries/  promotions/  pricing/
    sustainability/  platform-settings/  notifications/  bank-files/
    auth/  admin/
  mongo/                   GridFS uploads
  common/  users/
prisma/
  schema.prisma            102 models
  migrations/              22, all applied
```

### `charging-stations` here is commerce, not operations

Worth knowing before you go looking for OCPP in this repo — **there is none.**

| | |
|---|---|
| **This repo** | `ChargingStation` (address, opening hours, ports free) and `ChargingProduct` (kW, `solarIncluded`, `priceUsd`). A public directory, and **selling piles to site owners** |
| **`uza-charge` repo** | Sessions, meter values, tariffs, faults, RFID, charger commands. **Running the hardware** |

They are not duplicates. They are the two halves of the business: one sells and lists stations,
the other operates them.

---

## Adding a feature

**1 · Model it** in `prisma/schema.prisma`, then:

```bash
npx prisma migrate dev --name your_change
```

**2 · Module** under `src/modules/<feature>/` — `*.module.ts`, `*.service.ts`,
`*.controller.ts`, `dto/`. Copy the shape of `src/modules/parts/`.

**3 · Business logic in the service**, not the controller. Controllers validate input with
`class-validator` DTOs, call the service, and return.

**4 · Register** the module in `src/app.module.ts`.

**5 · Document it** with `@ApiTags` / `@ApiOperation` so it appears in Swagger. That page is
how everybody else discovers your endpoint.

---

## Things that will bite you

**Prisma 7 with the `PrismaPg` driver adapter.** Configuration lives in `prisma.config.ts`,
which loads `dotenv/config`. `prisma generate` must run **before** `nest build` — the compiler
needs the generated types.

**`prisma` and `@prisma/client` are production dependencies, deliberately.** Do not move them
to `devDependencies`. This image migrates itself and runs itself, so both are runtime needs
however they look on a laptop. When they were dev dependencies, the container tried to
*download* `prisma@8.0.0-rc` from the network at startup. **The Dockerfile now fails the build
if either moves back**, so you find out in CI rather than at 2am.

**Uploads never touch the local disk.** They go to MongoDB GridFS. `PUBLIC_UPLOAD_BASE_URL` is
how a browser reaches them, and **getting it wrong fails silently** — every image URL the API
returns is unreachable, and nothing logs it.

---

## Testing

```bash
npm test              # vitest run
npm run test:watch
```

**The suite runs on vitest, not jest.** Jest could not load *any* transformer in this project —
not `ts-jest`, not `@swc/jest`, not `babel-jest`, which ships inside jest itself — so the suite
never ran at all. It was never diagnosed to a root cause. Vitest with `unplugin-swc` works, and
it means one runner across the estate: **UZA Nexus already uses vitest**, so a developer moving
between the two repositories writes tests the same way in both.

`src/modules/listings/listing-pricing.util.spec.ts` is the reference test — **copy its shape.**
It targets pure functions, needs no database, and runs in milliseconds. Where a service needs
Prisma, mock the client (see `src/app.controller.spec.ts`) rather than reaching for a real one.

**Coverage is thin and honest about it: 11 tests against 219 endpoints.** The runner working is
what unblocks that; writing them is the work. Start where a silent break costs money — pricing,
invoices, payments, financing.

**A local `.env` here points at `uza_mobility_test`.** Developing against a database whose name
says it is for tests is confusing the day somebody wonders where their data went.

---

## Deployment

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Postgres + MongoDB + the API + Caddy with automatic TLS. Only Caddy publishes a port. The image
is multi-stage, ~435MB, and runs migrations at container start — **read the comments in
`Dockerfile` before editing it.**

Whole-estate deployment (this plus Nexus and the three apps behind one proxy):
`00-group/deploy/` in the `UZA-SOLUTIONS-GUIDE` repository.

---

## Context

| | |
|---|---|
| What is verified, what is broken | `UZA-SOLUTIONS-GUIDE` → `00-group/audit-package.md` |
| How the systems relate | `00-group/how-the-systems-relate.md` |
| What should be one product | `00-group/the-product-architecture.md` |
| One person, one identity | `04-uza-cloud/uza-id-adoption.md` — **this repo adopts it first** |
| Where every repo and database is | `00-group/the-estate-map.md` |
