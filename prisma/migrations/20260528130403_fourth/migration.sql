-- CreateEnum
CREATE TYPE "OperatorStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('PUBLIC', 'PRIVATE', 'SEMI_PUBLIC', 'FLEET_ONLY');

-- CreateEnum
CREATE TYPE "StationOperationalStatus" AS ENUM ('OPERATIONAL', 'PARTIALLY_OPERATIONAL', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ChargerType" AS ENUM ('AC_TYPE2', 'DC_CCS', 'DC_CHADEMO', 'DC_GBDC', 'AC_TYPE1', 'TESLA_WALL');

-- CreateEnum
CREATE TYPE "SpeedCategory" AS ENUM ('SLOW', 'FAST', 'RAPID', 'ULTRA_RAPID');

-- CreateEnum
CREATE TYPE "CurrentType" AS ENUM ('AC', 'DC');

-- CreateEnum
CREATE TYPE "PortStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'FAULTED', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "StationPricingModel" AS ENUM ('PER_KWH', 'PER_MINUTE', 'PER_SESSION', 'FREE');

-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('PASSENGER_EV', 'TWO_THREE_WHEEL', 'COMMERCIAL_EV');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'OPERATOR_APPLICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'OPERATOR_APPLICATION_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'STATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'STATION_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'STATION_SUSPENDED';

-- CreateTable
CREATE TABLE "operator_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessRegNumber" TEXT,
    "contactPerson" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "logoUrl" TEXT,
    "description" TEXT,
    "status" "OperatorStatus" NOT NULL DEFAULT 'PENDING',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charging_stations" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "StationStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationType" "LocationType" NOT NULL DEFAULT 'PUBLIC',
    "isOpen24h" BOOLEAN NOT NULL DEFAULT false,
    "openingHours" JSONB,
    "totalPorts" INTEGER NOT NULL DEFAULT 0,
    "availablePorts" INTEGER,
    "hasParking" BOOLEAN NOT NULL DEFAULT false,
    "hasWifi" BOOLEAN NOT NULL DEFAULT false,
    "hasRestroom" BOOLEAN NOT NULL DEFAULT false,
    "hasCCTV" BOOLEAN NOT NULL DEFAULT false,
    "hasRoofCover" BOOLEAN NOT NULL DEFAULT false,
    "operationalStatus" "StationOperationalStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "adminNotes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charging_stations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charging_ports" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "portNumber" TEXT,
    "chargerType" "ChargerType" NOT NULL,
    "speedCategory" "SpeedCategory" NOT NULL,
    "powerKw" DOUBLE PRECISION NOT NULL,
    "voltage" INTEGER,
    "amperage" INTEGER,
    "currentType" "CurrentType" NOT NULL,
    "status" "PortStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charging_ports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_pricing" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "pricingModel" "StationPricingModel" NOT NULL,
    "rateAmount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "station_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_compatibility" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "vehicleCategory" "VehicleCategory" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_compatibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_photos" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "station_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "station_reviews" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "station_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operator_profiles_userId_key" ON "operator_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "charging_stations_slug_key" ON "charging_stations"("slug");

-- CreateIndex
CREATE INDEX "charging_stations_city_idx" ON "charging_stations"("city");

-- CreateIndex
CREATE INDEX "charging_stations_country_idx" ON "charging_stations"("country");

-- CreateIndex
CREATE INDEX "charging_stations_status_idx" ON "charging_stations"("status");

-- CreateIndex
CREATE INDEX "station_reviews_stationId_idx" ON "station_reviews"("stationId");

-- CreateIndex
CREATE INDEX "station_reviews_userId_idx" ON "station_reviews"("userId");

-- AddForeignKey
ALTER TABLE "operator_profiles" ADD CONSTRAINT "operator_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_stations" ADD CONSTRAINT "charging_stations_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charging_ports" ADD CONSTRAINT "charging_ports_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_pricing" ADD CONSTRAINT "station_pricing_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_compatibility" ADD CONSTRAINT "vehicle_compatibility_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_photos" ADD CONSTRAINT "station_photos_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_reviews" ADD CONSTRAINT "station_reviews_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "charging_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "station_reviews" ADD CONSTRAINT "station_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
