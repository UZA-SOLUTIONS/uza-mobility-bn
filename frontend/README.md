# UZA Mobility — front end

The browser application for the UZA Mobility API. React 19, Vite 8, Tailwind 4,
React Router 7, Axios, React Icons.

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173, proxying /api to http://localhost:7000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the built bundle on 4173 |
| `npm run typecheck` | Types only |
| `npm test` | The registry tests |

The API must be running. From the repository root: `docker compose up -d`, or point
`VITE_DEV_API_TARGET` at wherever it lives.

---

## The one thing to understand before changing anything

**Portals are data.** `src/portals/registry.ts` describes every portal — who may enter,
what the navigation is, which paths belong to it. Routes, guards, layouts and the
portal switcher are all generated from it.

Adding a fourth bank is one row:

```ts
export const LENDERS: LenderConfig[] = [
  { key: 'unguka', name: 'Unguka Bank (LOLC)', seesCollateral: true },
  { key: 'equity', name: 'Equity Bank Rwanda' },
  { key: 'ncba',   name: 'NCBA Rwanda' },
  { key: 'bk',     name: 'Bank of Kigali' },   // <- this is the whole change
];
```

That produces the portal, its five screens, its route tree, its role check
(`LENDER_BK`) and its entry in the switcher. No component, route file or `switch`
statement mentions it. `npm test` proves this property for every lender configured.

The remaining step is a `LENDER_BK` role row in the database, assigned to that bank's
users.

### Why it is built this way

A portal that needs a developer, a pull request and a deploy every time a lender signs
is a portal that gets bypassed by somebody emailing a spreadsheet — which is the
disclosure the whole design exists to prevent.

### The one thing that is deliberately *not* data

`seesCollateral` controls whether a lender sees the cash-collateral facility. It is
`false` by default and only Unguka has it. Onboarding a lender is routine and should be
easy; granting one sight of that facility is a founder's decision, and it should cost a
file change, a test change and a review. `registry.test.ts` fails if that list changes.

For a lender without it, the facility is **absent**, not disabled. A greyed-out link
still tells Equity the facility exists, and that is itself the disclosure.

---

## Layout

```
src/
  api/          axios instance, token storage, envelope unwrapping, refresh rotation
  auth/         AuthProvider, useAuth, route guards
  portals/      the registry - start here
  layouts/      the portal shell (sidebar, header, portal switcher)
  pages/        screens, one folder per portal
  components/   shared UI and the assistant
  hooks/        useApi
  lib/          env, formatters
  routes.tsx    generated from the registry
```

### Three things worth knowing

**The API wraps every response** in `{ success, data }`. One response interceptor in
`api/client.ts` unwraps it, so no screen writes `res.data.data`. Changing the envelope
is that one function.

**The refresh token travels in the `Authorization` header**, not the body — that is the
API's contract for `/auth/refresh` and `/auth/logout`. Sending it in the body fails with
a 401 that looks exactly like an expired session.

**The access token is in memory only**; only the refresh token is in `localStorage`.
A token in `localStorage` is readable by any script that reaches the page, and this
application shows loan files. Losing the session on reload is the price, and the
refresh token pays it. Tighter still would be an httpOnly cookie set by the API — that
change is confined to `api/tokens.ts`.

---

## Guards are a convenience, not a control

Every rule the route guard enforces is also enforced by the API, which is the only place
enforcement counts. Hiding a link stops an honest person clicking it and stops nobody
else. What the guard buys is that a lender never loads a screen full of errors it was
never meant to see.

**Never move an authorisation decision into this application.**

---

## Screens ahead of their API

Some screens are built against endpoints that are not deployed. A `404` renders a plain
"not connected in this environment" panel rather than a red error, because nothing is
broken — the screen is simply ahead of its API.

| Screen | State |
|---|---|
| Client home, payments, vehicle, documents | Wired to live endpoints |
| Charging finder, station list | Wired; slot holds await `POST /charging-stations/:id/holds` |
| Operations dashboard, listings, orders, financing | Wired to `/admin/*` |
| Workshop board, job cards, rescue, parts, mechanics | **No API yet** — the workshop's rules exist as tested code in `src/modules/workshop/` with no HTTP surface |
| All lender screens | **No API yet** — no `/financing/lenders/*` routes exist |
| Assistant | **No API yet** — awaits `POST /assistant/ask` |

The assistant sends the question to the API and renders the answer. **It never answers
anything itself.** This application shows loan balances and repayment dates; a widget
that guessed would eventually tell a driver their arrears were cleared when they were
not, and UZA would own that. When the endpoint is absent it says so and stops.

---

## Deployment

```bash
docker build -t uza-mobility-frontend \
  --build-arg VITE_API_BASE_URL=https://api.uzamobility.rw \
  --build-arg VITE_ENVIRONMENT=production .
```

Vite inlines environment values at build time, so the API URL is a build argument, not a
runtime one — a different environment means a different image, which is also what makes
the image reproducible.

nginx serves the bundle and falls back to `index.html`, so refreshing on
`/lender/unguka/applications` works. Hashed assets cache for a year; `index.html` does
not, or a deploy leaves people on the previous bundle.

Outside production the environment name shows as a badge in the header, so nobody
demonstrates staging believing it is production.
