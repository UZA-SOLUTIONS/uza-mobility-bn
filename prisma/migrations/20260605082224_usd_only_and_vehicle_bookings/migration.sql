-- CreateEnum
CREATE TYPE "VehicleBookingStatus" AS ENUM ('AWAITING_PAYMENT', 'PAYMENT_SUBMITTED', 'UNDER_VERIFICATION', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "isBooked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "vehicle_bookings" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "paymentReference" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingFeeUsd" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "VehicleBookingStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "amountPaid" DOUBLE PRECISION,
    "bankName" TEXT,
    "transferReference" TEXT,
    "paymentDate" TIMESTAMP(3),
    "senderName" TEXT,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "validUntil" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_payment_proofs" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_payment_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_bookings_bookingNumber_key" ON "vehicle_bookings"("bookingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_bookings_paymentReference_key" ON "vehicle_bookings"("paymentReference");

-- CreateIndex
CREATE INDEX "vehicle_bookings_listingId_idx" ON "vehicle_bookings"("listingId");

-- CreateIndex
CREATE INDEX "vehicle_bookings_userId_idx" ON "vehicle_bookings"("userId");

-- CreateIndex
CREATE INDEX "vehicle_bookings_status_idx" ON "vehicle_bookings"("status");

-- AddForeignKey
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_bookings" ADD CONSTRAINT "vehicle_bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payment_proofs" ADD CONSTRAINT "booking_payment_proofs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "vehicle_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
