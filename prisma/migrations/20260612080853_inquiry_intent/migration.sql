-- CreateEnum
CREATE TYPE "InquiryIntent" AS ENUM ('BUY', 'BOOK');

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN     "intent" "InquiryIntent" NOT NULL DEFAULT 'BOOK';
