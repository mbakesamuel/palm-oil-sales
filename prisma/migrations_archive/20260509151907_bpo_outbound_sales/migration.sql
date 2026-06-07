-- CreateEnum
CREATE TYPE "BpoEmployeeCollectedProduct" AS ENUM ('LOOSE_PALM_OIL', 'BOTTLED_PALM_OIL');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIT';

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estate" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BpoEmployeeCreditSale" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "collectedProduct" "BpoEmployeeCollectedProduct" NOT NULL,
    "productVariantId" TEXT,
    "rationPeriodYear" INTEGER,
    "rationPeriodMonth" INTEGER,
    "rationLimitUnitsSnapshot" DECIMAL(14,3),
    "rationUsedBeforeUnitsSnapshot" DECIMAL(14,3),
    "rationBalanceAfterUnitsSnapshot" DECIMAL(14,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BpoEmployeeCreditSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_matricule_key" ON "Employee"("matricule");

-- CreateIndex
CREATE INDEX "Employee_name_idx" ON "Employee"("name");

-- CreateIndex
CREATE INDEX "Employee_estate_idx" ON "Employee"("estate");

-- CreateIndex
CREATE UNIQUE INDEX "BpoEmployeeCreditSale_saleId_key" ON "BpoEmployeeCreditSale"("saleId");

-- CreateIndex
CREATE INDEX "BpoEmployeeCreditSale_employeeId_rationPeriodYear_rationPer_idx" ON "BpoEmployeeCreditSale"("employeeId", "rationPeriodYear", "rationPeriodMonth", "collectedProduct");

-- CreateIndex
CREATE INDEX "BpoEmployeeCreditSale_productVariantId_idx" ON "BpoEmployeeCreditSale"("productVariantId");

-- AddForeignKey
ALTER TABLE "BpoEmployeeCreditSale" ADD CONSTRAINT "BpoEmployeeCreditSale_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoEmployeeCreditSale" ADD CONSTRAINT "BpoEmployeeCreditSale_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoEmployeeCreditSale" ADD CONSTRAINT "BpoEmployeeCreditSale_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
