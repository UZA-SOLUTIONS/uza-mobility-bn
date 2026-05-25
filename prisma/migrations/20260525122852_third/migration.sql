/*
  Warnings:

  - A unique constraint covering the columns `[userId,sellerType]` on the table `sellers` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "sellers_userId_key";

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "createdByUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sellers_userId_sellerType_key" ON "sellers"("userId", "sellerType");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
