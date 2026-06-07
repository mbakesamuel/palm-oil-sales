-- Replaces the per-product `form` enum (LOOSE / BOTTLED / SECONDARY) with a
-- category-level `isBottled` flag. The new business rule is binary: products
-- are either bottled (BPO outbound only) or non-bottled (POS + Delivery
-- Orders); the legacy "SECONDARY" catalog-only state disappears.
--
-- Safe to run because the products table is currently empty -- there is no
-- per-row form data to migrate. The BPO category is backfilled to
-- `isBottled = true` so future products in that category inherit the right
-- UoM.

-- 1. Add the new flag to ProductCat.
ALTER TABLE "ProductCat"
  ADD COLUMN "isBottled" BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill BPO -> bottled.
UPDATE "ProductCat" SET "isBottled" = true WHERE "productCode" = 'BPO';

-- 3. Enforce a single bottled category at the DB level (same shape as the
--    existing ProductCat_isMain_unique partial index).
CREATE UNIQUE INDEX "ProductCat_isBottled_unique"
  ON "ProductCat" ("isBottled")
  WHERE "isBottled" = true;

-- 4. Drop the per-product form column. (The table has no rows, so no data
--    loss.)
ALTER TABLE "Product" DROP COLUMN "form";

-- 5. Drop the now-unused enum type.
DROP TYPE "ProductForm";
