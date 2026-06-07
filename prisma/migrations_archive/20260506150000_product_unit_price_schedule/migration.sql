-- Versioned ex-tax unit prices per product; Main category also keys by customer type.

CREATE TABLE IF NOT EXISTS "ProductUnitPriceSchedule" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "customerType" "CustomerType",
    "unitPriceExTax" DECIMAL(14,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUnitPriceSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductUnitPriceSchedule_productId_effectiveFrom_idx"
  ON "ProductUnitPriceSchedule" ("productId", "effectiveFrom");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProductUnitPriceSchedule_productId_fkey'
  ) THEN
    ALTER TABLE "ProductUnitPriceSchedule"
      ADD CONSTRAINT "ProductUnitPriceSchedule_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("productId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- Main-category rows: one price per product + customer type + effective date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ProductUnitPriceSchedule_product_customer_effective_key'
  ) THEN
    CREATE UNIQUE INDEX "ProductUnitPriceSchedule_product_customer_effective_key"
      ON "ProductUnitPriceSchedule" ("productId", "customerType", "effectiveFrom")
      WHERE "customerType" IS NOT NULL;
  END IF;
END
$$;

-- Non-Main (direct): one price per product + effective date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'ProductUnitPriceSchedule_product_effective_direct_key'
  ) THEN
    CREATE UNIQUE INDEX "ProductUnitPriceSchedule_product_effective_direct_key"
      ON "ProductUnitPriceSchedule" ("productId", "effectiveFrom")
      WHERE "customerType" IS NULL;
  END IF;
END
$$;
