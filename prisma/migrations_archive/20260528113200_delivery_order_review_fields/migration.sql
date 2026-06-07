-- DeliveryOrder bulk validation support: manager review checkpoint.

ALTER TABLE "DeliveryOrder"
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByUserId" TEXT;

CREATE INDEX "DeliveryOrder_status_reviewedAt_idx"
  ON "DeliveryOrder" ("status", "reviewedAt");

ALTER TABLE "DeliveryOrder"
  ADD CONSTRAINT "DeliveryOrder_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

