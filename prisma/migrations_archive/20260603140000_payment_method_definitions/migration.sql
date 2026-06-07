-- CreateEnum
CREATE TYPE "PaymentMethodKind" AS ENUM ('SIMPLE', 'CHEQUE', 'TRAITE', 'CREDIT');

-- CreateTable
CREATE TABLE "PaymentMethodDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PaymentMethodKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentMethodDefinition_code_key" ON "PaymentMethodDefinition"("code");
CREATE INDEX "PaymentMethodDefinition_isActive_sortOrder_idx" ON "PaymentMethodDefinition"("isActive", "sortOrder");

-- Seed built-in payment methods
INSERT INTO "PaymentMethodDefinition" ("id", "code", "name", "kind", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
VALUES
  ('pm_cash', 'CASH', 'Cash', 'SIMPLE', 10, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pm_cheque', 'CHEQUE', 'Cheque', 'CHEQUE', 20, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pm_traite', 'TRAITE', 'Traite', 'TRAITE', 30, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('pm_credit', 'CREDIT', 'Credit', 'CREDIT', 40, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add FK columns (nullable during backfill)
ALTER TABLE "Payment" ADD COLUMN "paymentMethodId" TEXT;
ALTER TABLE "DeliveryOrderPaymentDetails" ADD COLUMN "paymentMethodId" TEXT;

-- Backfill from legacy enum
UPDATE "Payment" SET "paymentMethodId" = 'pm_cash' WHERE "method" = 'CASH';
UPDATE "Payment" SET "paymentMethodId" = 'pm_cheque' WHERE "method" = 'CHEQUE';
UPDATE "Payment" SET "paymentMethodId" = 'pm_traite' WHERE "method" = 'TRAITE';
UPDATE "Payment" SET "paymentMethodId" = 'pm_credit' WHERE "method" = 'CREDIT';

UPDATE "DeliveryOrderPaymentDetails" SET "paymentMethodId" = 'pm_cash' WHERE "method" = 'CASH';
UPDATE "DeliveryOrderPaymentDetails" SET "paymentMethodId" = 'pm_cheque' WHERE "method" = 'CHEQUE';
UPDATE "DeliveryOrderPaymentDetails" SET "paymentMethodId" = 'pm_traite' WHERE "method" = 'TRAITE';
UPDATE "DeliveryOrderPaymentDetails" SET "paymentMethodId" = 'pm_credit' WHERE "method" = 'CREDIT';

-- Drop legacy enum columns and indexes
DROP INDEX IF EXISTS "Payment_method_paidAt_idx";
ALTER TABLE "Payment" DROP COLUMN "method";
ALTER TABLE "DeliveryOrderPaymentDetails" DROP COLUMN "method";

-- Enforce NOT NULL + FK
ALTER TABLE "Payment" ALTER COLUMN "paymentMethodId" SET NOT NULL;
ALTER TABLE "DeliveryOrderPaymentDetails" ALTER COLUMN "paymentMethodId" SET NOT NULL;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethodDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryOrderPaymentDetails" ADD CONSTRAINT "DeliveryOrderPaymentDetails_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethodDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Payment_paymentMethodId_paidAt_idx" ON "Payment"("paymentMethodId", "paidAt");

-- Drop legacy enum type
DROP TYPE "PaymentMethod";
