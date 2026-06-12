-- DropForeignKey
ALTER TABLE "fleet_requests" DROP CONSTRAINT "fleet_requests_userId_fkey";

-- AlterTable
ALTER TABLE "fleet_requests" ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "fleet_requests" ADD CONSTRAINT "fleet_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "fleet_requests_email_idx" ON "fleet_requests"("email");
