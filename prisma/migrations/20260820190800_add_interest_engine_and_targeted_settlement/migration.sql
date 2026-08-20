-- AlterEnum
ALTER TYPE "CompoundingFrequency" ADD VALUE 'DAILY';
ALTER TYPE "CompoundingFrequency" ADD VALUE 'WEEKLY';
ALTER TYPE "CompoundingFrequency" ADD VALUE 'HALF_YEARLY';
ALTER TYPE "CompoundingFrequency" ADD VALUE 'CUSTOM';

-- CreateEnum
CREATE TYPE "InterestType" AS ENUM ('NO_INTEREST', 'SIMPLE', 'COMPOUND');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "default_interest_type" "InterestType" NOT NULL DEFAULT 'SIMPLE',
ADD COLUMN "custom_compound_days" INTEGER;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "interest_type" "InterestType",
ADD COLUMN "interest_rate" DECIMAL(5,2),
ADD COLUMN "compounding_frequency" "CompoundingFrequency",
ADD COLUMN "custom_compound_days" INTEGER,
ADD COLUMN "due_date" TIMESTAMP(3),
ADD COLUMN "target_entry_id" TEXT;

-- CreateIndex
CREATE INDEX "transactions_target_entry_id_idx" ON "transactions"("target_entry_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_target_entry_id_fkey" FOREIGN KEY ("target_entry_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
