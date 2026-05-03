-- Per-sales-point stock: Batch.location + sale line consumption audit

ALTER TABLE "Batch" ADD COLUMN "salesPointId" INTEGER;

UPDATE "Batch" b
SET "salesPointId" = (SELECT id FROM "SalesPoint" ORDER BY id ASC LIMIT 1)
WHERE b."salesPointId" IS NULL;

ALTER TABLE "Batch" ALTER COLUMN "salesPointId" SET NOT NULL;

ALTER TABLE "Batch" ADD CONSTRAINT "Batch_salesPointId_fkey" FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Batch_productId_receivedAt_idx";

CREATE INDEX "Batch_salesPointId_productId_receivedAt_idx" ON "Batch"("salesPointId", "productId", "receivedAt");
CREATE INDEX "Batch_productId_receivedAt_idx" ON "Batch"("productId", "receivedAt");

CREATE TABLE "SaleLineBatchAllocation" (
    "id" TEXT NOT NULL,
    "saleLineId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "qtyKg" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "SaleLineBatchAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaleLineBatchAllocation_saleLineId_batchId_key" ON "SaleLineBatchAllocation"("saleLineId", "batchId");
CREATE INDEX "SaleLineBatchAllocation_batchId_idx" ON "SaleLineBatchAllocation"("batchId");
CREATE INDEX "SaleLineBatchAllocation_saleLineId_idx" ON "SaleLineBatchAllocation"("saleLineId");

ALTER TABLE "SaleLineBatchAllocation" ADD CONSTRAINT "SaleLineBatchAllocation_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaleLineBatchAllocation" ADD CONSTRAINT "SaleLineBatchAllocation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
