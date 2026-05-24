-- Promote each ProductVariant to its own Product (form BOTTLED), re-point stock/sales/pricing, then drop variants.

CREATE TABLE "_VariantProductMigration" (
  "variantId" TEXT PRIMARY KEY,
  "newProductId" INT NOT NULL
);

DO $$
DECLARE
  r RECORD;
  new_id INT;
  label TEXT;
BEGIN
  FOR r IN
    SELECT
      v.id AS variant_id,
      v.name AS variant_name,
      p."productId" AS parent_id,
      p."productName" AS parent_name,
      p."productCatId",
      p."productCode",
      p."commercialServiceId"
    FROM "ProductVariant" v
    INNER JOIN "Product" p ON p."productId" = v."productId"
    ORDER BY v.id
  LOOP
    label := r.parent_name;
    IF r.variant_name IS NOT NULL AND r.variant_name <> '' AND r.variant_name <> r.parent_name THEN
      label := r.parent_name || ' - ' || r.variant_name;
    END IF;

    INSERT INTO "Product" (
      "productName",
      "productCode",
      "productCatId",
      "form",
      "uom",
      "commercialServiceId",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      label,
      r."productCode",
      r."productCatId",
      'BOTTLED'::"ProductForm",
      'Unit',
      r."commercialServiceId",
      NOW(),
      NOW()
    )
    RETURNING "productId" INTO new_id;

    INSERT INTO "_VariantProductMigration" ("variantId", "newProductId")
    VALUES (r.variant_id, new_id);
  END LOOP;
END $$;

-- Variant price schedules → product unit prices (direct / non-segmented).
INSERT INTO "ProductUnitPriceSchedule" (
  "id",
  "productId",
  "customerType",
  "unitPriceExTax",
  "effectiveFrom",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || ps."id" || clock_timestamp()::text),
  m."newProductId",
  NULL,
  ps."unitPriceExTax",
  ps."effectiveFrom",
  ps."createdAt",
  ps."updatedAt"
FROM "ProductVariantPriceSchedule" ps
INNER JOIN "_VariantProductMigration" m ON m."variantId" = ps."productVariantId";

UPDATE "StockLot" sl
SET
  "productId" = m."newProductId",
  "productVariantId" = NULL
FROM "_VariantProductMigration" m
WHERE sl."productVariantId" = m."variantId";

UPDATE "StockMovementLine" sml
SET
  "productId" = m."newProductId",
  "productVariantId" = NULL
FROM "_VariantProductMigration" m
WHERE sml."productVariantId" = m."variantId";

UPDATE "SaleLine" sl
SET
  "productId" = m."newProductId",
  "productVariantId" = NULL
FROM "_VariantProductMigration" m
WHERE sl."productVariantId" = m."variantId";

UPDATE "StockAllocation" sa
SET "productVariantId" = NULL
WHERE sa."productVariantId" IS NOT NULL;

ALTER TABLE "BpoEmployeeCreditSale" ADD COLUMN IF NOT EXISTS "productId" INT;

UPDATE "BpoEmployeeCreditSale" b
SET "productId" = m."newProductId"
FROM "_VariantProductMigration" m
WHERE b."productVariantId" = m."variantId";

ALTER TABLE "BpoEmployeeCreditSale" DROP COLUMN IF EXISTS "productVariantId";
ALTER TABLE "BpoEmployeeCreditSale"
  ADD CONSTRAINT "BpoEmployeeCreditSale_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "BpoEmployeeCreditSale_productId_idx" ON "BpoEmployeeCreditSale"("productId");

ALTER TABLE "StockLot" DROP COLUMN IF EXISTS "productVariantId";
ALTER TABLE "StockMovementLine" DROP COLUMN IF EXISTS "productVariantId";
ALTER TABLE "SaleLine" DROP COLUMN IF EXISTS "productVariantId";
ALTER TABLE "StockAllocation" DROP COLUMN IF EXISTS "productVariantId";

DROP TABLE IF EXISTS "ProductVariantPriceSchedule";
DROP TABLE IF EXISTS "ProductVariant";

DROP TABLE "_VariantProductMigration";
