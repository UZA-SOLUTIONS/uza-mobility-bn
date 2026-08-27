# UZA Mobility platform — production image.
#
# Multi-stage so the shipped layer carries the built app and its runtime dependencies, and none
# of the toolchain. Node 22 because package.json declares engines >=20 and 22 is the current LTS.
#
# Two things about this repository shape the file and are worth knowing before editing it:
#
#   · It uses npm and package-lock.json, not pnpm. `npm ci` is the reproducible install and it
#     fails loudly if the lockfile and package.json disagree, which is what you want in a build.
#   · Prisma 7 with the pg driver adapter. `prisma generate` must run BEFORE `nest build`,
#     because the compiler needs the generated client's types. `prisma.config.ts` reads
#     DATABASE_URL through dotenv, so generation itself needs no live database — only migrate
#     does, and that happens at container start, not at build time.

# ---------------------------------------------------------------- build
FROM node:22-alpine AS build
WORKDIR /app

# openssl is required by Prisma's engines on alpine.
RUN apk add --no-cache openssl

# Dependencies first, so a source-only change does not reinstall the world.
#
# --ignore-scripts is required, not tidiness. package.json runs `prisma generate` as a
# postinstall, and at this point prisma/schema.prisma has not been copied in yet — so the
# install fails with a bare "command failed" that names npm rather than the missing schema.
# Generation happens explicitly below, once the schema is present.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# The schema before the source: generate needs it, and it changes far less often.
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Drop the build-only dependencies from what gets copied forward.
RUN npm prune --omit=dev

# ---------------------------------------------------------------- runtime
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Run as a non-root user. The node image ships one; use it rather than inventing another.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./
COPY --from=build --chown=node:node /app/package.json ./

# Uploads. Mounted as a volume in compose so the files outlive the container.
RUN mkdir -p /app/storage && chown -R node:node /app/storage

USER node
EXPOSE 7000

# Migrations run at start, not at build: the database does not exist during a build, and
# `migrate deploy` applies committed migrations only — it never prompts and never resets.
# If a migration fails the container exits rather than serving against a half-migrated schema.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
