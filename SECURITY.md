# Security

## Reporting

Email **info@uzasolutions.com**. Do not open a public issue for a suspected
vulnerability.

## What this service handles

Buyer and seller identities, national ID references, financing applications and
payment records. Rwandan Law N° 058/2021 on personal data protection applies, and the
default assumption for any new field is that it is personal data until shown otherwise.

Two structural rules the code is built around:

- **UZA never holds client money.** The API computes and displays; banks and mobile
  money operators move funds under the client's own instructions.
- **The API never warrants repayment and never gives financial advice.**

## Controls in place

| | |
|---|---|
| Transport | Helmet security headers; HSTS, `nosniff`, `SAMEORIGIN`, `no-referrer` |
| CORS | Allow-list from `CORS_ORIGINS`. Defaults to localhost only — an unset production origin fails closed |
| Rate limiting | 120 req/min globally; 5 req/min on `login`, `register`, `forgot-password`, `reset-password`, `verify-email`, `admin/login`. `trust proxy` is set so the limit sees the client IP, not Caddy's |
| Body size | 1 MB on JSON and urlencoded |
| API docs | Swagger is off in production unless `ENABLE_SWAGGER=true` |
| Auth | JWT access + rotating refresh tokens, bcrypt password hashing |
| Input | Global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted` — unknown fields are rejected, not ignored |
| Secrets | No `.env` file is tracked in git. `JWT_SECRET` refuses to boot on the documented placeholder |
| Types | `strict` is on. `any` is an eslint error |

## Open advisories, and why

`npm audit` is run on every push (advisory, non-blocking — a CVE published overnight
must be visible without turning every branch red).

**Three high-severity advisories are currently open, and all three are the same
finding:** `deepmerge-ts` reachable through `@prisma/config`, a stack-exhaustion
denial of service when merging deeply recursive object graphs.

**Not remediated, deliberately.** `npm audit fix` proposes downgrading Prisma from
7.10 to 6.12 — two major versions backwards. That would drop the driver adapter this
service depends on and take a much larger quantity of unpatched code with it.

Assessment: `@prisma/config` parses `prisma.config.ts` when the **CLI** runs. It is
not on any request path, and the input is a file in this repository rather than
anything a user submits. There is no untrusted input reaching it.

**Revisit when Prisma ships a 7.x release with the patched dependency.** Re-check on
every `prisma` upgrade; if the count changes, this section is out of date.

_Assessed 30 August 2026._

## Reviewed and closed

**Attachment-by-file-path removed.** `MailService` accepted
`fileAttachments: [{ filename, path }]`, which nodemailer reads directly off the
local filesystem. Nothing called it — it was a dormant file-read primitive, one wiring
change away from letting a request name any path the API process can read and have it
emailed out. Attachments are now passed by content only, so the decision about which
file is read happens at the call site where it can be reviewed.
