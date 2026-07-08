-- Pricing rule percentage discount + stored rule discount on listings/invoices
ALTER TABLE "pricing_rules" ADD COLUMN "discountRatePercent" DOUBLE PRECISION;

ALTER TABLE "listing_pricing" ADD COLUMN "ruleDiscountUsd" DOUBLE PRECISION;

ALTER TABLE "invoices" ADD COLUMN "ruleDiscountUsd" DOUBLE PRECISION;
