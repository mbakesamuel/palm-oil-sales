-- CustomerType enum -> CustomerTypeDefinition table + customerTypeId FK columns.
-- Safe for production DBs that still have the legacy "customerType" enum column.

CREATE TABLE IF NOT EXISTS "CustomerTypeDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerTypeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTypeDefinition_code_key"
  ON "CustomerTypeDefinition"("code");
CREATE INDEX IF NOT EXISTS "CustomerTypeDefinition_isActive_sortOrder_idx"
  ON "CustomerTypeDefinition"("isActive", "sortOrder");

INSERT INTO "CustomerTypeDefinition" ("id", "code", "name", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
VALUES
  ('ct_industry', 'INDUSTRY', 'Industry', 10, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ct_whole_sale', 'WHOLE_SALE', 'Whole sale', 20, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ct_retail', 'RETAIL', 'Retail', 30, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ct_worker', 'WORKER', 'Worker', 40, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "sortOrder" = EXCLUDED."sortOrder",
  "isSystem" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Customer'
      AND column_name = 'customerTypeId'
  ) THEN
    ALTER TABLE "Customer" ADD COLUMN "customerTypeId" TEXT;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Customer'
        AND column_name = 'customerType'
    ) THEN
      UPDATE "Customer"
      SET "customerTypeId" = CASE "customerType"::text
        WHEN 'INDUSTRY' THEN 'ct_industry'
        WHEN 'WHOLE_SALE' THEN 'ct_whole_sale'
        WHEN 'RETAIL' THEN 'ct_retail'
        WHEN 'WORKER' THEN 'ct_worker'
        ELSE 'ct_industry'
      END;
    ELSE
      UPDATE "Customer" SET "customerTypeId" = 'ct_industry' WHERE "customerTypeId" IS NULL;
    END IF;

    ALTER TABLE "Customer" ALTER COLUMN "customerTypeId" SET NOT NULL;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Customer'
        AND column_name = 'customerType'
    ) THEN
      ALTER TABLE "Customer" DROP COLUMN "customerType";
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Customer_customerTypeId_fkey'
  ) THEN
    ALTER TABLE "Customer"
      ADD CONSTRAINT "Customer_customerTypeId_fkey"
      FOREIGN KEY ("customerTypeId") REFERENCES "CustomerTypeDefinition"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Customer_customerTypeId_idx" ON "Customer"("customerTypeId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ProductUnitPriceSchedule'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ProductUnitPriceSchedule'
      AND column_name = 'customerTypeId'
  ) THEN
    DROP INDEX IF EXISTS "ProductUnitPriceSchedule_product_customer_effective_key";
    DROP INDEX IF EXISTS "ProductUnitPriceSchedule_product_effective_direct_key";

    ALTER TABLE "ProductUnitPriceSchedule" ADD COLUMN "customerTypeId" TEXT;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ProductUnitPriceSchedule'
        AND column_name = 'customerType'
    ) THEN
      UPDATE "ProductUnitPriceSchedule"
      SET "customerTypeId" = CASE "customerType"::text
        WHEN 'INDUSTRY' THEN 'ct_industry'
        WHEN 'WHOLE_SALE' THEN 'ct_whole_sale'
        WHEN 'RETAIL' THEN 'ct_retail'
        WHEN 'WORKER' THEN 'ct_worker'
        ELSE NULL
      END
      WHERE "customerType" IS NOT NULL;

      ALTER TABLE "ProductUnitPriceSchedule" DROP COLUMN "customerType";
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ProductUnitPriceSchedule_customerTypeId_fkey'
    ) THEN
      ALTER TABLE "ProductUnitPriceSchedule"
        ADD CONSTRAINT "ProductUnitPriceSchedule_customerTypeId_fkey"
        FOREIGN KEY ("customerTypeId") REFERENCES "CustomerTypeDefinition"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    CREATE INDEX IF NOT EXISTS "ProductUnitPriceSchedule_customerTypeId_idx"
      ON "ProductUnitPriceSchedule"("customerTypeId");

    CREATE UNIQUE INDEX IF NOT EXISTS "ProductUnitPriceSchedule_product_customer_effective_key"
      ON "ProductUnitPriceSchedule"("productId", "customerTypeId", "effectiveFrom")
      WHERE ("customerTypeId" IS NOT NULL);

    CREATE UNIQUE INDEX IF NOT EXISTS "ProductUnitPriceSchedule_product_effective_direct_key"
      ON "ProductUnitPriceSchedule"("productId", "effectiveFrom")
      WHERE ("customerTypeId" IS NULL);
  END IF;
END $$;

DROP TYPE IF EXISTS "CustomerType";
