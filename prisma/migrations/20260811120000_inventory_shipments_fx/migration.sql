-- CreateEnum
CREATE TYPE "ListingInventoryStage" AS ENUM ('CHINA_UNPAID', 'IN_TRANSIT', 'AT_PORT', 'KIGALI_STOCK');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SHIPMENT_UPDATE';

-- AlterTable listings
ALTER TABLE "listings" ADD COLUMN "inventoryStage" "ListingInventoryStage" NOT NULL DEFAULT 'KIGALI_STOCK';
ALTER TABLE "listings" ADD COLUMN "inventoryPaidAt" TIMESTAMP(3);
ALTER TABLE "listings" ADD COLUMN "portArrivedAt" TIMESTAMP(3);
ALTER TABLE "listings" ADD COLUMN "kigaliArrivedAt" TIMESTAMP(3);

UPDATE "listings" SET "inventoryStage" = 'CHINA_UNPAID'
WHERE "sellerType" = 'UZA_CHINA_SOURCING';

UPDATE "listings" SET "inventoryStage" = 'KIGALI_STOCK'
WHERE "sellerType" = 'UZA_RWANDA_STOCK';

CREATE INDEX "listings_inventoryStage_idx" ON "listings"("inventoryStage");

-- CreateTable shipments
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT,
    "vesselName" TEXT,
    "voyageNumber" TEXT,
    "etaAt" TIMESTAMP(3),
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "terminalOfPickup" TEXT,
    "finalPlaceOfDelivery" TEXT,
    "containerNumber" TEXT,
    "sealNumber" TEXT,
    "carrierTrackUrl" TEXT,
    "arrivalNoticeFileUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shipments_containerNumber_idx" ON "shipments"("containerNumber");
CREATE INDEX "shipments_documentNumber_idx" ON "shipments"("documentNumber");

-- AlterTable orders
ALTER TABLE "orders" ADD COLUMN "vin" TEXT;
ALTER TABLE "orders" ADD COLUMN "shipmentId" TEXT;

CREATE INDEX "orders_vin_idx" ON "orders"("vin");
CREATE INDEX "orders_shipmentId_idx" ON "orders"("shipmentId");

ALTER TABLE "orders" ADD CONSTRAINT "orders_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
