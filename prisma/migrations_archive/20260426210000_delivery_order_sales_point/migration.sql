-- Add FK to SalesPoint; drop legacy free-text collection point
ALTER TABLE "DeliveryOrder" ADD COLUMN "salesPointId" INTEGER;

ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_salesPointId_fkey"
  FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DeliveryOrder_salesPointId_idx" ON "DeliveryOrder"("salesPointId");

ALTER TABLE "DeliveryOrder" DROP COLUMN IF EXISTS "collectionPoint";
