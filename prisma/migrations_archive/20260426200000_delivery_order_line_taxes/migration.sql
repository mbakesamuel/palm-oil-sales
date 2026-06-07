-- AlterTable
ALTER TABLE "DeliveryOrderDetails" ADD COLUMN "lineSubtotalExTax" DECIMAL(14,2),
ADD COLUMN "vatRate" DECIMAL(5,4),
ADD COLUMN "vatAmount" DECIMAL(14,2),
ADD COLUMN "otherTaxLabel" TEXT,
ADD COLUMN "otherTaxAmount" DECIMAL(14,2);

-- Backfill line subtotal from existing unit price × qty where possible
UPDATE "DeliveryOrderDetails"
SET "lineSubtotalExTax" = ROUND(("unitPrice" * "orderQty")::numeric, 2)::decimal(14,2)
WHERE "unitPrice" IS NOT NULL AND "lineSubtotalExTax" IS NULL;
