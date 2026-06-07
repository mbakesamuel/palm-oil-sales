-- CreateTable
CREATE TABLE "TaxType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRateSchedule" (
    "id" TEXT NOT NULL,
    "taxTypeId" TEXT NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRateSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRegimeTax" (
    "taxRegimeId" TEXT NOT NULL,
    "taxTypeId" TEXT NOT NULL,

    CONSTRAINT "TaxRegimeTax_pkey" PRIMARY KEY ("taxRegimeId","taxTypeId")
);

-- CreateTable
CREATE TABLE "SaleAppliedTax" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "taxTypeId" TEXT,
    "codeSnapshot" TEXT NOT NULL,
    "labelSnapshot" TEXT NOT NULL,
    "rateSnapshot" DECIMAL(5,4) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleAppliedTax_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxType_code_key" ON "TaxType"("code");

-- CreateIndex
CREATE INDEX "TaxRateSchedule_taxTypeId_effectiveFrom_idx" ON "TaxRateSchedule"("taxTypeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TaxRegimeTax_taxTypeId_idx" ON "TaxRegimeTax"("taxTypeId");

-- CreateIndex
CREATE INDEX "SaleAppliedTax_saleId_idx" ON "SaleAppliedTax"("saleId");

-- AddForeignKey
ALTER TABLE "TaxRateSchedule" ADD CONSTRAINT "TaxRateSchedule_taxTypeId_fkey" FOREIGN KEY ("taxTypeId") REFERENCES "TaxType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRegimeTax" ADD CONSTRAINT "TaxRegimeTax_taxRegimeId_fkey" FOREIGN KEY ("taxRegimeId") REFERENCES "TaxRegime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRegimeTax" ADD CONSTRAINT "TaxRegimeTax_taxTypeId_fkey" FOREIGN KEY ("taxTypeId") REFERENCES "TaxType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAppliedTax" ADD CONSTRAINT "SaleAppliedTax_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAppliedTax" ADD CONSTRAINT "SaleAppliedTax_taxTypeId_fkey" FOREIGN KEY ("taxTypeId") REFERENCES "TaxType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: seed VAT catalog from legacy CompanySettings and TaxRegime.vatApplies
INSERT INTO "TaxType" ("id", "code", "name", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'VAT', 'VAT', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "TaxType" WHERE "code" = 'VAT');

INSERT INTO "TaxRateSchedule" ("id", "taxTypeId", "rate", "effectiveFrom", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", cs."vatRate", DATE '1970-01-01', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "TaxType" t
CROSS JOIN "CompanySettings" cs
WHERE t."code" = 'VAT'
  AND cs."id" = 'default'
  AND NOT EXISTS (SELECT 1 FROM "TaxRateSchedule" trs WHERE trs."taxTypeId" = t."id");

INSERT INTO "TaxRegimeTax" ("taxRegimeId", "taxTypeId")
SELECT r."id", t."id"
FROM "TaxRegime" r
INNER JOIN "TaxType" t ON t."code" = 'VAT'
WHERE r."vatApplies" = true
ON CONFLICT DO NOTHING;

INSERT INTO "SaleAppliedTax" ("id", "saleId", "taxTypeId", "codeSnapshot", "labelSnapshot", "rateSnapshot", "amount", "createdAt")
SELECT gen_random_uuid()::text, s."id", t."id", 'VAT', t."name", s."vatRateSnapshot", s."vatAmount", CURRENT_TIMESTAMP
FROM "Sale" s
INNER JOIN "TaxType" t ON t."code" = 'VAT'
WHERE s."vatAmount" > 0
  AND NOT EXISTS (SELECT 1 FROM "SaleAppliedTax" a WHERE a."saleId" = s."id");
