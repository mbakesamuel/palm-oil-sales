-- CreateTable
CREATE TABLE "ProductSalesBudgetMonthPhaseProfile" (
    "id" TEXT NOT NULL,
    "financialYear" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "pctM01" DECIMAL(10,6) NOT NULL,
    "pctM02" DECIMAL(10,6) NOT NULL,
    "pctM03" DECIMAL(10,6) NOT NULL,
    "pctM04" DECIMAL(10,6) NOT NULL,
    "pctM05" DECIMAL(10,6) NOT NULL,
    "pctM06" DECIMAL(10,6) NOT NULL,
    "pctM07" DECIMAL(10,6) NOT NULL,
    "pctM08" DECIMAL(10,6) NOT NULL,
    "pctM09" DECIMAL(10,6) NOT NULL,
    "pctM10" DECIMAL(10,6) NOT NULL,
    "pctM11" DECIMAL(10,6) NOT NULL,
    "pctM12" DECIMAL(10,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSalesBudgetMonthPhaseProfile_pkey" PRIMARY KEY ("id")
);

-- Backfill: copy global default percentages to every (financial year × product) pair
INSERT INTO "ProductSalesBudgetMonthPhaseProfile" (
    "id",
    "financialYear",
    "productId",
    "pctM01", "pctM02", "pctM03", "pctM04", "pctM05", "pctM06",
    "pctM07", "pctM08", "pctM09", "pctM10", "pctM11", "pctM12",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    f."financialYear",
    p."productId",
    d."pctM01", d."pctM02", d."pctM03", d."pctM04", d."pctM05", d."pctM06",
    d."pctM07", d."pctM08", d."pctM09", d."pctM10", d."pctM11", d."pctM12",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "FinancialYearPeriod" f
CROSS JOIN "Product" p
CROSS JOIN "SalesBudgetMonthPhaseProfile" d
WHERE d."id" = 'default';

-- CreateIndex
CREATE UNIQUE INDEX "ProductSalesBudgetMonthPhaseProfile_financialYear_productId_key" ON "ProductSalesBudgetMonthPhaseProfile"("financialYear", "productId");

-- CreateIndex
CREATE INDEX "ProductSalesBudgetMonthPhaseProfile_financialYear_idx" ON "ProductSalesBudgetMonthPhaseProfile"("financialYear");

-- AddForeignKey
ALTER TABLE "ProductSalesBudgetMonthPhaseProfile" ADD CONSTRAINT "ProductSalesBudgetMonthPhaseProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE "SalesBudgetMonthPhaseProfile";
