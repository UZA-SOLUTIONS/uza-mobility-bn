/*
  Warnings:

  - A unique constraint covering the columns `[referenceNumber]` on the table `fleet_requests` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `referenceNumber` to the `fleet_requests` table without a default value. This is not possible if the table is not empty.
  - Made the column `email` on table `fleet_requests` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "fleet_requests" ADD COLUMN     "referenceNumber" TEXT NOT NULL,
ADD COLUMN     "summaryPdfUrl" TEXT,
ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "fleet_requests_referenceNumber_key" ON "fleet_requests"("referenceNumber");
