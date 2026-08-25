-- Pricing rule fixed costs: USD → RWF (convert using frozen display rate).

DO $$
DECLARE
  rate double precision := COALESCE(
    (
      SELECT NULLIF(TRIM(ps.value), '')::double precision
      FROM platform_settings AS ps
      WHERE ps.key = 'usdToRwfEffective'
    ),
    1472.8279
  );
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pricing_rules'
      AND column_name = 'shippingCostUsd'
  ) THEN
    ALTER TABLE "pricing_rules" RENAME COLUMN "shippingCostUsd" TO "shippingCostRwf";
    UPDATE "pricing_rules"
    SET "shippingCostRwf" = ROUND("shippingCostRwf" * rate)
    WHERE "shippingCostRwf" IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pricing_rules'
      AND column_name = 'localChargesUsd'
  ) THEN
    ALTER TABLE "pricing_rules" RENAME COLUMN "localChargesUsd" TO "localChargesRwf";
    UPDATE "pricing_rules"
    SET "localChargesRwf" = ROUND("localChargesRwf" * rate)
    WHERE "localChargesRwf" IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pricing_rules'
      AND column_name = 'storagePerDayUsd'
  ) THEN
    ALTER TABLE "pricing_rules" RENAME COLUMN "storagePerDayUsd" TO "storagePerDayRwf";
    UPDATE "pricing_rules"
    SET "storagePerDayRwf" = ROUND("storagePerDayRwf" * rate)
    WHERE "storagePerDayRwf" IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pricing_rules'
      AND column_name = 'clearingFeeUsd'
  ) THEN
    ALTER TABLE "pricing_rules" RENAME COLUMN "clearingFeeUsd" TO "clearingFeeRwf";
    UPDATE "pricing_rules"
    SET "clearingFeeRwf" = ROUND("clearingFeeRwf" * rate)
    WHERE "clearingFeeRwf" IS NOT NULL;
  END IF;
END $$;
