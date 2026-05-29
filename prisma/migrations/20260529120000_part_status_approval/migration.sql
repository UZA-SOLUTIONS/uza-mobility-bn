-- CreateEnum
CREATE TYPE "PartStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "parts" ADD COLUMN "status" "PartStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "parts" ADD COLUMN "adminNotes" TEXT;
ALTER TABLE "parts" ALTER COLUMN "isActive" SET DEFAULT false;

-- Existing live parts stay visible
UPDATE "parts" SET "status" = 'APPROVED', "isActive" = true WHERE "isActive" = true;
