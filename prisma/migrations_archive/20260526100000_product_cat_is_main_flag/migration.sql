-- Promote the "Main category" classification from a hard-coded id (1) to a
-- proper boolean column on ProductCat. A partial unique index guarantees at
-- most one Main category per environment.

ALTER TABLE "ProductCat"
  ADD COLUMN "isMain" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: the legacy convention was that productCatId = 1 is the Main
-- category. Preserve that here so existing pricing rules keep working without
-- manual intervention.
UPDATE "ProductCat"
SET "isMain" = true
WHERE "productCatId" = 1;

-- At most one row may carry isMain = true. Implemented as a partial unique
-- index on the truthy condition.
CREATE UNIQUE INDEX "ProductCat_isMain_unique"
  ON "ProductCat" ("isMain")
  WHERE "isMain" = true;
