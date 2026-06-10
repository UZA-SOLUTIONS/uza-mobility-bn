-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "brochureUrl" TEXT,
ADD COLUMN     "isFullOption" BOOLEAN NOT NULL DEFAULT false;
