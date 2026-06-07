-- DropIndex
DROP INDEX "SaleLineBatchAllocation_saleLineId_idx";

-- AlterTable
ALTER TABLE "DeliveryOrder" ALTER COLUMN "postingCalendarYear" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Sale" ALTER COLUMN "postingCalendarYear" DROP NOT NULL;

-- CreateTable
CREATE TABLE "VehicleConsignmentNoteSequence" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleConsignmentNoteSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleConsignmentNote" (
    "id" TEXT NOT NULL,
    "consignmentNoteNo" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "dateOfLifting" DATE NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "consigneeName" TEXT NOT NULL,
    "dateOfConsignment" DATE NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverNicNo" TEXT NOT NULL,
    "receiverNicPlaceOfIssue" TEXT NOT NULL,
    "receivedDate" DATE,
    "status" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validatedAt" TIMESTAMP(3),
    "validatedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleConsignmentNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VehicleConsignmentNote_consignmentNoteNo_key" ON "VehicleConsignmentNote"("consignmentNoteNo");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleConsignmentNote_saleId_key" ON "VehicleConsignmentNote"("saleId");

-- CreateIndex
CREATE INDEX "VehicleConsignmentNote_saleId_idx" ON "VehicleConsignmentNote"("saleId");

-- CreateIndex
CREATE INDEX "VehicleConsignmentNote_consignmentNoteNo_idx" ON "VehicleConsignmentNote"("consignmentNoteNo");

-- CreateIndex
CREATE INDEX "VehicleConsignmentNote_status_idx" ON "VehicleConsignmentNote"("status");

-- AddForeignKey
ALTER TABLE "VehicleConsignmentNote" ADD CONSTRAINT "VehicleConsignmentNote_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleConsignmentNote" ADD CONSTRAINT "VehicleConsignmentNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleConsignmentNote" ADD CONSTRAINT "VehicleConsignmentNote_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "DeliveryOrder_financialYear_postingCalendarYear_financialMonth_" RENAME TO "DeliveryOrder_financialYear_postingCalendarYear_financialMo_idx";
