-- Line-scoped customers; optional line tag on tax regimes.

ALTER TABLE "Customer" ADD COLUMN "commercialServiceId" TEXT;

UPDATE "Customer"
SET "commercialServiceId" = (
  SELECT "id" FROM "CommercialService"
  WHERE "code" = 'default'
  ORDER BY "sortOrder" ASC
  LIMIT 1
);

UPDATE "Customer"
SET "commercialServiceId" = (SELECT "id" FROM "CommercialService" ORDER BY "sortOrder" ASC LIMIT 1)
WHERE "commercialServiceId" IS NULL;

ALTER TABLE "Customer" ALTER COLUMN "commercialServiceId" SET NOT NULL;

CREATE INDEX "Customer_commercialServiceId_idx" ON "Customer"("commercialServiceId");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_commercialServiceId_fkey" FOREIGN KEY ("commercialServiceId") REFERENCES "CommercialService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TaxRegime" ADD COLUMN "commercialServiceId" TEXT;

CREATE INDEX "TaxRegime_commercialServiceId_idx" ON "TaxRegime"("commercialServiceId");

ALTER TABLE "TaxRegime" ADD CONSTRAINT "TaxRegime_commercialServiceId_fkey" FOREIGN KEY ("commercialServiceId") REFERENCES "CommercialService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaxRegime" DROP CONSTRAINT IF EXISTS "TaxRegime_name_key";

CREATE UNIQUE INDEX "TaxRegime_commercialServiceId_name_key" ON "TaxRegime"("commercialServiceId", "name");
