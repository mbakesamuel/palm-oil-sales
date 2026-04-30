-- Backfill missing sales point (uses lowest id). Requires at least one SalesPoint row if any DeliveryOrder has NULL.
UPDATE "DeliveryOrder" AS d
SET "salesPointId" = (SELECT id FROM "SalesPoint" ORDER BY id ASC LIMIT 1)
WHERE d."salesPointId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "DeliveryOrder" WHERE "salesPointId" IS NULL) THEN
    RAISE EXCEPTION 'Migration blocked: add at least one SalesPoint before applying, or fix DeliveryOrder rows with NULL salesPointId.';
  END IF;
END $$;

ALTER TABLE "DeliveryOrder" DROP COLUMN IF EXISTS "referenceNumber";

ALTER TABLE "DeliveryOrder" DROP CONSTRAINT IF EXISTS "DeliveryOrder_salesPointId_fkey";

ALTER TABLE "DeliveryOrder" ALTER COLUMN "salesPointId" SET NOT NULL;

ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_salesPointId_fkey"
  FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
