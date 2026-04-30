-- Sale: vehicle, date issued, delivery order link.
-- Idempotent (IF NOT EXISTS) so this can recover after a previously broken migration attempt.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "vehicleNumber" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "dateIssued" TIMESTAMP(3);

UPDATE "Sale" SET "dateIssued" = "soldAt" WHERE "dateIssued" IS NULL;

ALTER TABLE "Sale" ALTER COLUMN "dateIssued" SET NOT NULL;

ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "deliveryOrderNo" TEXT;

CREATE INDEX IF NOT EXISTS "Sale_deliveryOrderNo_idx" ON "Sale"("deliveryOrderNo");
