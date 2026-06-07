-- Replace CustomerType enum with admin-managed CustomerTypeDefinition rows.

CREATE TABLE "CustomerTypeDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerTypeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerTypeDefinition_code_key" ON "CustomerTypeDefinition"("code");
CREATE INDEX "CustomerTypeDefinition_isActive_sortOrder_idx" ON "CustomerTypeDefinition"("isActive", "sortOrder");

INSERT INTO "CustomerTypeDefinition" ("id", "code", "name", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
VALUES
  ('ct_industry', 'INDUSTRY', 'Industry', 10, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ct_whole_sale', 'WHOLE_SALE', 'Whole sale', 20, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ct_retail', 'RETAIL', 'Retail', 30, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ct_worker', 'WORKER', 'Worker', 40, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "Customer" ADD COLUMN "customerTypeId" TEXT;

UPDATE "Customer"
SET "customerTypeId" = CASE "customerType"::text
  WHEN 'INDUSTRY' THEN 'ct_industry'
  WHEN 'WHOLE_SALE' THEN 'ct_whole_sale'
  WHEN 'RETAIL' THEN 'ct_retail'
  WHEN 'WORKER' THEN 'ct_worker'
  ELSE 'ct_industry'
END;

ALTER TABLE "Customer" ALTER COLUMN "customerTypeId" SET NOT NULL;
ALTER TABLE "Customer" DROP COLUMN "customerType";
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_customerTypeId_fkey"
  FOREIGN KEY ("customerTypeId") REFERENCES "CustomerTypeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Customer_customerTypeId_idx" ON "Customer"("customerTypeId");

DROP INDEX IF EXISTS "ProductUnitPriceSchedule_product_customer_effective_key";
DROP INDEX IF EXISTS "ProductUnitPriceSchedule_product_effective_direct_key";

ALTER TABLE "ProductUnitPriceSchedule" ADD COLUMN "customerTypeId" TEXT;

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
ALTER TABLE "ProductUnitPriceSchedule" ADD CONSTRAINT "ProductUnitPriceSchedule_customerTypeId_fkey"
  FOREIGN KEY ("customerTypeId") REFERENCES "CustomerTypeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ProductUnitPriceSchedule_customerTypeId_idx" ON "ProductUnitPriceSchedule"("customerTypeId");

CREATE UNIQUE INDEX "ProductUnitPriceSchedule_product_customer_effective_key"
  ON "ProductUnitPriceSchedule"("productId", "customerTypeId", "effectiveFrom")
  WHERE ("customerTypeId" IS NOT NULL);

CREATE UNIQUE INDEX "ProductUnitPriceSchedule_product_effective_direct_key"
  ON "ProductUnitPriceSchedule"("productId", "effectiveFrom")
  WHERE ("customerTypeId" IS NULL);

DROP TYPE "CustomerType";
