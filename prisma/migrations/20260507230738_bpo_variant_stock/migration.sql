-- CreateEnum
CREATE TYPE "BpoMovementType" AS ENUM ('CONSIGNMENT_TRANSFER', 'GIFT', 'OTHER_OUT');

-- CreateEnum
CREATE TYPE "BpoMovementStatus" AS ENUM ('DRAFT', 'SENDER_VALIDATED', 'VALIDATED', 'REJECTED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isBottledPalmOil" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN     "productVariantId" TEXT,
ADD COLUMN     "qtyUnits" DECIMAL(14,3),
ADD COLUMN     "unitPricePerUnit" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL DEFAULT 'Bottle',
    "unitQuantity" DECIMAL(14,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariantPriceSchedule" (
    "id" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "unitPriceExTax" DECIMAL(14,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariantPriceSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BpoStockBatch" (
    "id" TEXT NOT NULL,
    "salesPointId" INTEGER NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qtyReceivedUnits" DECIMAL(14,3) NOT NULL,
    "qtyRemainingUnits" DECIMAL(14,3) NOT NULL,
    "sourceMovementLineId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BpoStockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BpoSaleLineBatchAllocation" (
    "id" TEXT NOT NULL,
    "saleLineId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "qtyUnits" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "BpoSaleLineBatchAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BpoStockMovement" (
    "id" TEXT NOT NULL,
    "movementType" "BpoMovementType" NOT NULL,
    "status" "BpoMovementStatus" NOT NULL DEFAULT 'DRAFT',
    "voucherNo" TEXT NOT NULL,
    "sourceSalesPointId" INTEGER,
    "destinationSalesPointId" INTEGER,
    "movementDate" DATE NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "discrepancyNote" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "senderValidatedByUserId" TEXT,
    "senderValidatedAt" TIMESTAMP(3),
    "botaValidatedByUserId" TEXT,
    "botaValidatedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BpoStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BpoStockMovementLine" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "voucherQtyUnits" DECIMAL(14,3) NOT NULL,
    "actualQtyUnits" DECIMAL(14,3),
    "postedQtyUnits" DECIMAL(14,3),
    "note" TEXT,

    CONSTRAINT "BpoStockMovementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_name_key" ON "ProductVariant"("productId", "name");

-- CreateIndex
CREATE INDEX "ProductVariantPriceSchedule_productVariantId_effectiveFrom_idx" ON "ProductVariantPriceSchedule"("productVariantId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantPriceSchedule_productVariantId_effectiveFrom_key" ON "ProductVariantPriceSchedule"("productVariantId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "BpoStockBatch_salesPointId_productVariantId_receivedAt_idx" ON "BpoStockBatch"("salesPointId", "productVariantId", "receivedAt");

-- CreateIndex
CREATE INDEX "BpoStockBatch_productVariantId_receivedAt_idx" ON "BpoStockBatch"("productVariantId", "receivedAt");

-- CreateIndex
CREATE INDEX "BpoSaleLineBatchAllocation_batchId_idx" ON "BpoSaleLineBatchAllocation"("batchId");

-- CreateIndex
CREATE INDEX "BpoSaleLineBatchAllocation_productVariantId_idx" ON "BpoSaleLineBatchAllocation"("productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "BpoSaleLineBatchAllocation_saleLineId_batchId_key" ON "BpoSaleLineBatchAllocation"("saleLineId", "batchId");

-- CreateIndex
CREATE UNIQUE INDEX "BpoStockMovement_voucherNo_key" ON "BpoStockMovement"("voucherNo");

-- CreateIndex
CREATE INDEX "BpoStockMovement_movementType_status_movementDate_idx" ON "BpoStockMovement"("movementType", "status", "movementDate");

-- CreateIndex
CREATE INDEX "BpoStockMovement_sourceSalesPointId_status_idx" ON "BpoStockMovement"("sourceSalesPointId", "status");

-- CreateIndex
CREATE INDEX "BpoStockMovement_destinationSalesPointId_status_idx" ON "BpoStockMovement"("destinationSalesPointId", "status");

-- CreateIndex
CREATE INDEX "BpoStockMovementLine_movementId_idx" ON "BpoStockMovementLine"("movementId");

-- CreateIndex
CREATE INDEX "BpoStockMovementLine_productVariantId_idx" ON "BpoStockMovementLine"("productVariantId");

-- CreateIndex
CREATE INDEX "SaleLine_productVariantId_idx" ON "SaleLine"("productVariantId");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariantPriceSchedule" ADD CONSTRAINT "ProductVariantPriceSchedule_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoStockBatch" ADD CONSTRAINT "BpoStockBatch_salesPointId_fkey" FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoStockBatch" ADD CONSTRAINT "BpoStockBatch_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoStockBatch" ADD CONSTRAINT "BpoStockBatch_sourceMovementLineId_fkey" FOREIGN KEY ("sourceMovementLineId") REFERENCES "BpoStockMovementLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoSaleLineBatchAllocation" ADD CONSTRAINT "BpoSaleLineBatchAllocation_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoSaleLineBatchAllocation" ADD CONSTRAINT "BpoSaleLineBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BpoStockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoSaleLineBatchAllocation" ADD CONSTRAINT "BpoSaleLineBatchAllocation_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoStockMovement" ADD CONSTRAINT "BpoStockMovement_sourceSalesPointId_fkey" FOREIGN KEY ("sourceSalesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoStockMovement" ADD CONSTRAINT "BpoStockMovement_destinationSalesPointId_fkey" FOREIGN KEY ("destinationSalesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoStockMovement" ADD CONSTRAINT "BpoStockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoStockMovement" ADD CONSTRAINT "BpoStockMovement_senderValidatedByUserId_fkey" FOREIGN KEY ("senderValidatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoStockMovement" ADD CONSTRAINT "BpoStockMovement_botaValidatedByUserId_fkey" FOREIGN KEY ("botaValidatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoStockMovementLine" ADD CONSTRAINT "BpoStockMovementLine_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "BpoStockMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BpoStockMovementLine" ADD CONSTRAINT "BpoStockMovementLine_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
