-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM (
  'REGISTERED',
  'READY_FOR_REGISTRATION',
  'IMPORT_PENDING',
  'NOT_APPLICABLE'
);

-- AlterTable
ALTER TABLE "listings"
ALTER COLUMN "registrationStatus" TYPE "RegistrationStatus"
USING (
  CASE
    WHEN "registrationStatus" IS NULL THEN NULL
    WHEN "registrationStatus" IN (
      'REGISTERED',
      'READY_FOR_REGISTRATION',
      'IMPORT_PENDING',
      'NOT_APPLICABLE'
    ) THEN "registrationStatus"::"RegistrationStatus"
    WHEN "registrationStatus" ILIKE '%ready%'
      OR "registrationStatus" ILIKE '%first registration%' THEN 'READY_FOR_REGISTRATION'::"RegistrationStatus"
    WHEN "registrationStatus" ILIKE '%import%'
      OR "registrationStatus" ILIKE '%pending%' THEN 'IMPORT_PENDING'::"RegistrationStatus"
    WHEN "registrationStatus" ILIKE '%not applicable%'
      OR "registrationStatus" ILIKE '%n/a%' THEN 'NOT_APPLICABLE'::"RegistrationStatus"
    WHEN "registrationStatus" ILIKE '%registered%' THEN 'REGISTERED'::"RegistrationStatus"
    ELSE 'NOT_APPLICABLE'::"RegistrationStatus"
  END
);
