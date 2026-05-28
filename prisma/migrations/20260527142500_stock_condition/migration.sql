-- Add stock condition dimension (sellable vs unsellable) without changing existing data.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockCondition') THEN
    CREATE TYPE "StockCondition" AS ENUM ('SELLABLE', 'UNSELLABLE');
  END IF;
END $$;

ALTER TABLE "StockMovement"
ADD COLUMN IF NOT EXISTS "condition" "StockCondition" NOT NULL DEFAULT 'SELLABLE';

ALTER TABLE "StockBalance"
ADD COLUMN IF NOT EXISTS "condition" "StockCondition" NOT NULL DEFAULT 'SELLABLE';

-- Backfill (defensive; columns are NOT NULL with default already).
UPDATE "StockMovement" SET "condition" = 'SELLABLE' WHERE "condition" IS NULL;
UPDATE "StockBalance" SET "condition" = 'SELLABLE' WHERE "condition" IS NULL;

-- Update StockBalance primary key to include condition.
ALTER TABLE "StockBalance" DROP CONSTRAINT IF EXISTS "StockBalance_pkey";
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_pkey"
PRIMARY KEY ("salesPointId", "productId", "storageLocationId", "condition");

