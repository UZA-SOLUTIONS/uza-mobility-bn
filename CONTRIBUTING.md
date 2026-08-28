# Contributing

For anyone with write access to a UZA repository. Read once; it takes five minutes and
saves an argument later.

---

## The loop

```bash
git switch -c your-name/what-it-does     # never commit to master directly
# ... work ...
npx tsc --noEmit && npm test              # typecheck + the suite
git push -u origin your-name/what-it-does
# open a pull request
```

**Both, before every push.** If it fails locally it will fail in CI, and finding out
in ninety seconds beats finding out in a pipeline ten minutes later.

---

## Branches and pull requests

**Branch naming:** `your-name/short-description` — `gad/split-listings-service`. Your name
first so `git branch -a` tells everyone who is working on what.

**One pull request, one concern.** A PR that fixes a bug *and* renames a folder *and* adds a
feature cannot be reviewed properly, and cannot be reverted cleanly when one third of it turns
out to be wrong.

**Every PR needs a green CI tick and one review.** Not ceremony — a second pair of eyes is the
cheapest defect-finding tool there is, and the reviewer learns the system.

**Say what and why in the description.** The diff already shows what changed. What it cannot
show is what you tried that did not work, and what you decided not to do.

---

## What we will ask you to change in review

Only these, and each exists because of something that actually went wrong here.

**Business logic in the service, not the controller.** Controllers validate input with
`class-validator` DTOs, call the service, and return. Nothing else.

**Document the endpoint** with `@ApiTags` / `@ApiOperation`. Swagger at `/api/docs` is how
everybody else discovers your work, and it is the only endpoint list that cannot go stale.

**`prisma` and `@prisma/client` stay production dependencies.** This image migrates itself and
runs itself. When they were dev dependencies the container tried to *download*
`prisma@8.0.0-rc` from the network at startup. The Dockerfile now fails the build if either
moves back.

**Cover the change with a test.** Not every line — the *behaviour*.
`src/modules/listings/listing-pricing.util.spec.ts` is the reference shape: pure functions, no
database, milliseconds. Where a service needs Prisma, mock the client — see
`src/app.controller.spec.ts`.

**Coverage here is thin and honest about it: 11 tests against 219 endpoints.** Start where a
silent break costs money — pricing, invoices, payments, financing.

**Keep comments short.** What a line does, or a trap in one or two lines. Reasoning goes in
`docs/` with a link. This codebase currently runs about twice the comment density of a
hand-written one and is being corrected, not defended.

---

## Files to read before you touch them

Three files encode rules with **legal** consequences, not stylistic ones. Each has tests
naming specific counterparties.

| | Why |
|---|---|
| `Dockerfile` | Ordering that is not obvious — generate before build, and why prisma must not be pruned |
| `src/modules/listings/listing-pricing.util.ts` | Which price a listing must carry per seller type. The wrong one prices the vehicle from the wrong basis |
| `prisma/schema.prisma` | 102 models and 22 applied migrations. Never edit a migration that has run |

The equivalent confidentiality rules live in **UZA Nexus** — `intake-lanes.ts` and
`lender-view-access.ts`. If a test in either repo's protected files fails, **do not adjust the
test.** Come and ask.

---

## Secrets

**Never commit a `.env`.** Every repo has a `.env.example` — copy it. Two repos had a tracked
`.env` until 29 August 2026; it held only publishable keys, but a tracked `.env` is how a
service-role key eventually gets committed by somebody who did not notice.

**This repo needs two databases** — Postgres and MongoDB. The API refuses to start without
`MONGODB_URI`, correctly, and the message is easy to miss in a wall of startup logs.

**Two kinds of key, and the difference matters more than anything else here:**

| | |
|---|---|
| **Publishable / anon** | Public by design. It ships to every browser anyway. Safe in a client bundle or a build arg |
| **Service role, `JWT_SECRET`, `UZA_ID_PEPPER`, `MFA_ENCRYPTION_KEY`** | **Run time only.** Never a build arg — build args are recorded in image history and travel with the image into any registry |

**If you commit a secret by accident: say so immediately and rotate it.** Deleting the commit
does not help — the value is already in every clone and in the reflog. Rotating is the only
fix, and it is quick when you say so quickly.

The documents repository has `tools/check-before-push.py`, which catches phone numbers,
national IDs and literal credentials. **Read its exit code** — piping it into `tail` hides the
failure, which is how six findings once went out.

---

## Personal data

Candidate names, national IDs, phone numbers and loan files are **never** committed to any
repository. Seeds read them from a path supplied at run time.

UZA Nexus holds no national ID or phone number in clear — only peppered hashes, for
matching. Keep it that way: it is the strongest control available, and under Law N° 058/2021
the obligation follows the data.

---

## Working alongside other people

Two of us edited the same files at the same time on 28 August and produced a red build twice.
Cheap to avoid:

- **Say what you are picking up** before you start, in whatever channel the team uses.
- **Small branches, merged often.** A branch open for two weeks is a merge conflict with a
  countdown on it.
- **If you find someone else's work in progress in your tree, do not "clean it up".** Ask.

---

## When something is wrong

**Change it.** Nothing here is sacred. Much of this code was written with AI assistance and
some of it is wrong — a stale README, a comment three times longer than it needs to be, a test
asserting `"Hello World!"` against an endpoint that never returned it.

The tests exist so you can change things confidently. **If you find something wrong and leave
it because you assume it was deliberate, that is the worst outcome.**

Two things to raise rather than fix silently: anything in the files above, and anything that
changes what a lender, a donor or a regulator would be told.
