-- CreateTable
CREATE TABLE "SalesBudgetMonthPhaseProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
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

    CONSTRAINT "SalesBudgetMonthPhaseProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSalesBudget" (
    "id" TEXT NOT NULL,
    "financialYear" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "annualQtyKg" DECIMAL(14,3) NOT NULL,
    "budgetUnitPricePerKg" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSalesBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSalesBudget_financialYear_idx" ON "ProductSalesBudget"("financialYear");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSalesBudget_financialYear_productId_key" ON "ProductSalesBudget"("financialYear", "productId");

-- AddForeignKey
ALTER TABLE "ProductSalesBudget" ADD CONSTRAINT "ProductSalesBudget_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;
