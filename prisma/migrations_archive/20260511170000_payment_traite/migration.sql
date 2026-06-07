-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'TRAITE';

-- AlterTable
ALTER TABLE "Payment"
  ADD COLUMN "traiteNo" TEXT,
  ADD COLUMN "traiteIssuedOn" DATE,
  ADD COLUMN "traiteMaturityOn" DATE;
