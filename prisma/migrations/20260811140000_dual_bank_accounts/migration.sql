-- Dual USD / Rwf receiving accounts on invoices + FX snapshot on payments/bookings
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "rwfBankName" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "rwfAccountNumber" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "exchangeRateUsed" DOUBLE PRECISION;

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "exchangeRateUsed" DOUBLE PRECISION;

ALTER TABLE "vehicle_bookings" ADD COLUMN IF NOT EXISTS "exchangeRateUsed" DOUBLE PRECISION;
