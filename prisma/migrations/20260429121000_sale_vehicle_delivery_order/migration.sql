-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "vehicleNumber" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "dateIssued" TIMESTAMP(3);

UPDATE "Sale" SET "dateIssued" = "soldAt" WHERE "dateIssued" IS NULL;

ALTER TABLE "Sale" ALTER COLUMN "dateIssued" SET NOT NULL;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "deliveryOrderNo" TEXT;

-- CreateIndex
CREATE INDEX "Sale_deliveryOrderNo_idx" ON "Sale"("deliveryOrderNo");
