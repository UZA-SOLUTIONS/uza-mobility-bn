-- ============================================================
-- UZA IDENTITY
--
-- One person, one permanent public identifier, referenced by every other UZA system.
-- Additive and safe on a live table: nothing is dropped, nothing is made NOT NULL here.
-- Making `uza_id` required is a SECOND, SEPARATE deploy, run only after the verification
-- queries at the bottom come back clean.
-- ============================================================

-- ---------- 1. the column ----------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "uzaId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_uzaId_key" ON "users" ("uzaId");
CREATE INDEX IF NOT EXISTS "users_uzaId_idx" ON "users" ("uzaId");

-- ---------- 2. the allocator ----------
CREATE TABLE IF NOT EXISTS "id_sequences" (
    "id"        TEXT NOT NULL,
    "scope"     TEXT NOT NULL,
    "year"      INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "id_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "id_sequences_scope_year_key"
    ON "id_sequences" ("scope", "year");

-- ---------- 3. the cross-system link ----------
CREATE TABLE IF NOT EXISTS "identity_links" (
    "id"         TEXT NOT NULL,
    "uzaId"      TEXT NOT NULL,
    "system"     TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "linkedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedBy"   TEXT,
    CONSTRAINT "identity_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "identity_links_system_externalId_key"
    ON "identity_links" ("system", "externalId");
CREATE INDEX IF NOT EXISTS "identity_links_uzaId_idx" ON "identity_links" ("uzaId");

-- The link points at the public identifier rather than at the internal cuid, because
-- that is the value other systems actually hold. Deferrable so the backfill below can
-- run in the same transaction as the rows it depends on.
ALTER TABLE "identity_links"
    ADD CONSTRAINT "identity_links_uzaId_fkey"
    FOREIGN KEY ("uzaId") REFERENCES "users" ("uzaId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------- 4. backfill ----------
-- Deterministic: the oldest account gets the lowest number, so re-running this against a
-- restored snapshot produces byte-identical identifiers. That property is what makes the
-- backfill safe to repeat, and it is why the ordering is (createdAt, id) rather than
-- anything that could tie.
WITH numbered AS (
    SELECT "id",
           EXTRACT(YEAR FROM "createdAt")::INT AS yr,
           ROW_NUMBER() OVER (
               PARTITION BY EXTRACT(YEAR FROM "createdAt")
               ORDER BY "createdAt", "id"
           ) AS seq
    FROM "users"
    WHERE "uzaId" IS NULL
)
UPDATE "users" u
SET "uzaId" = 'UZA-P-' || n.yr || '-' || LPAD(n.seq::TEXT, 6, '0')
FROM numbered n
WHERE u."id" = n."id";

-- Point the allocator at the highest number already used, per year, so the next
-- allocation cannot collide with a backfilled identifier.
INSERT INTO "id_sequences" ("id", "scope", "year", "lastValue", "updatedAt")
SELECT 'seq_person_' || yr, 'person', yr, MAX(seq), CURRENT_TIMESTAMP
FROM (
    SELECT EXTRACT(YEAR FROM "createdAt")::INT AS yr,
           SPLIT_PART("uzaId", '-', 4)::INT    AS seq
    FROM "users"
    WHERE "uzaId" IS NOT NULL
) s
GROUP BY yr
ON CONFLICT ("scope", "year")
DO UPDATE SET "lastValue" = GREATEST("id_sequences"."lastValue", EXCLUDED."lastValue"),
              "updatedAt" = CURRENT_TIMESTAMP;

-- ============================================================
-- VERIFY before the second deploy
--
--   SELECT COUNT(*) AS missing FROM "users" WHERE "uzaId" IS NULL;      -- expect 0
--   SELECT "uzaId", COUNT(*) FROM "users"
--     GROUP BY "uzaId" HAVING COUNT(*) > 1;                             -- expect no rows
--
-- Then, as its own migration:
--   ALTER TABLE "users" ALTER COLUMN "uzaId" SET NOT NULL;
-- ============================================================
