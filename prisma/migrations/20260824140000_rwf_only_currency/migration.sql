-- RWF listing/invoice/booking amounts. Existing USD rows stay as-is.
-- Pricing rule USD→RWF rename lives in 20260825110000_pricing_rules_rwf.

ALTER TABLE "listing_pricing"
  ADD COLUMN IF NOT EXISTS "basePriceRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "fobPriceRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "sellerDesiredPayoutRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "shippingCostRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "localChargesRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "taxesEstimateRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "insuranceRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "storageRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "clearingFeeRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "landingCostRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "marginRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "commissionRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "ruleDiscountRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "discountRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "finalPriceRwf" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "displayPriceRwf" DOUBLE PRECISION;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "totalAmountRwf" DOUBLE PRECISION;

ALTER TABLE "vehicle_bookings"
  ADD COLUMN IF NOT EXISTS "bookingFeeRwf" DOUBLE PRECISION;

-- Display/sort key for leftover USD listings using the frozen cached rate when present.
UPDATE "listing_pricing" AS lp
SET "displayPriceRwf" = ROUND(lp."finalPriceUsd" * COALESCE(NULLIF(ps.value, '')::double precision, 1472.8279))
FROM "platform_settings" AS ps
WHERE ps.key = 'usdToRwfEffective'
  AND lp."displayPriceRwf" IS NULL
  AND lp."currency" = 'USD';

UPDATE "listing_pricing"
SET "displayPriceRwf" = ROUND("finalPriceUsd" * 1472.8279)
WHERE "displayPriceRwf" IS NULL
  AND "currency" = 'USD';

INSERT INTO "platform_settings" ("key", "value", "updatedAt")
SELECT 'usdToRwfEffective', '1472.8279', NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "platform_settings" WHERE "key" = 'usdToRwfEffective'
);

UPDATE "platform_settings"
SET "value" = '1472.8279'
WHERE "key" = 'usdToRwfEffective'
  AND (TRIM("value") = '' OR "value" IS NULL);

INSERT INTO "platform_settings" ("key", "value", "updatedAt")
SELECT
  'bookingFeeRwf',
  ROUND(
    COALESCE(
      (
        SELECT NULLIF(TRIM(bf."value"), '')::double precision
        FROM "platform_settings" AS bf
        WHERE bf."key" = 'bookingFeeUsd'
      ),
      500
    )
    * COALESCE(
      (
        SELECT NULLIF(TRIM(rt."value"), '')::double precision
        FROM "platform_settings" AS rt
        WHERE rt."key" = 'usdToRwfEffective'
      ),
      1472.8279
    )
  )::text,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "platform_settings" WHERE "key" = 'bookingFeeRwf'
);
