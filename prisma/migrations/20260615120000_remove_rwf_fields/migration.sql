-- Drop RWF / exchange-rate columns (USD-only pricing)
ALTER TABLE "pricing_rules" DROP COLUMN IF EXISTS "exchangeRateRwf";
ALTER TABLE "listing_pricing" DROP COLUMN IF EXISTS "finalPriceRwf";
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "totalAmountRwf";
