-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED');

-- AlterTable
ALTER TABLE "DeliveryOrder" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "referenceNumber" TEXT,
ADD COLUMN     "status" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedByUserId" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "referenceNumber" TEXT,
ADD COLUMN     "salesPointId" INTEGER,
ADD COLUMN     "status" "ValidationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "DeliveryOrder_status_dateIssued_idx" ON "DeliveryOrder"("status", "dateIssued");

-- CreateIndex
CREATE INDEX "Sale_status_soldAt_idx" ON "Sale"("status", "soldAt");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_salesPointId_fkey" FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_validatedByUserId_fkey" FOREIGN KEY ("validatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
