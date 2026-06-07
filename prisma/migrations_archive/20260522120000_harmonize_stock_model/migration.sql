-- Harmonize stock model: ProductForm, Mill, ISSUE movement type, default floor locations

CREATE TYPE "ProductForm" AS ENUM ('LOOSE', 'BOTTLED', 'SECONDARY');

ALTER TABLE "Product" ADD COLUMN "form" "ProductForm";
ALTER TABLE "Product" ADD COLUMN "uom" TEXT;

UPDATE "Product"
SET
  "form" = CASE
    WHEN "isBottledPalmOil" = true OR "stockTracking" = 'VARIANT' THEN 'BOTTLED'::"ProductForm"
    WHEN "stockTracking" = 'NONE' THEN 'SECONDARY'::"ProductForm"
    ELSE 'LOOSE'::"ProductForm"
  END,
  "uom" = CASE
    WHEN "isBottledPalmOil" = true OR "stockTracking" = 'VARIANT' THEN 'Unit'
    ELSE 'Kg'
  END;

ALTER TABLE "Product" ALTER COLUMN "form" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "form" SET DEFAULT 'LOOSE';
ALTER TABLE "Product" ALTER COLUMN "uom" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "uom" SET DEFAULT 'Kg';

CREATE TABLE "Mill" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mill_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Mill" ("name", "updatedAt") VALUES ('Main mill', CURRENT_TIMESTAMP);

ALTER TABLE "SalesPoint" ADD COLUMN "millId" INTEGER;
UPDATE "SalesPoint" SET "millId" = (SELECT "id" FROM "Mill" LIMIT 1);
ALTER TABLE "SalesPoint" ADD CONSTRAINT "SalesPoint_millId_fkey"
  FOREIGN KEY ("millId") REFERENCES "Mill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "SalesPoint_millId_idx" ON "SalesPoint"("millId");

ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'ISSUE';

UPDATE "StockMovement"
SET "movementType" = 'ISSUE'
WHERE "movementType" IN ('ISSUE_GIFT', 'ISSUE_OTHER', 'ADJUSTMENT');

-- Default floor storage location per sales point for bottled receipts
INSERT INTO "StorageLocation" ("salesPointId", "name", "createdAt", "updatedAt")
SELECT sp."id", 'Floor', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "SalesPoint" sp
WHERE NOT EXISTS (
  SELECT 1 FROM "StorageLocation" sl
  WHERE sl."salesPointId" = sp."id" AND sl."name" = 'Floor'
);

UPDATE "StockLot" sl
SET "storageLocationId" = (
  SELECT sloc."id" FROM "StorageLocation" sloc
  WHERE sloc."salesPointId" = sl."salesPointId" AND sloc."name" = 'Floor'
  LIMIT 1
)
WHERE sl."storageLocationId" IS NULL;
