-- Unified stock: enums, tables, data migration from Batch / Bpo*

CREATE TYPE "StockTracking" AS ENUM ('NONE', 'BULK', 'VARIANT');
CREATE TYPE "StockUom" AS ENUM ('KG', 'UNIT');
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'TRANSFER', 'ISSUE_GIFT', 'ISSUE_OTHER', 'ADJUSTMENT');
CREATE TYPE "StockMovementStatus" AS ENUM ('DRAFT', 'SENDER_VALIDATED', 'VALIDATED', 'REJECTED');

ALTER TABLE "Product" ADD COLUMN "stockTracking" "StockTracking" NOT NULL DEFAULT 'BULK';

UPDATE "Product"
SET "stockTracking" = 'VARIANT'
WHERE "isBottledPalmOil" = true;

-- StockLot
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "salesPointId" INTEGER NOT NULL,
    "storageLocationId" INTEGER,
    "productId" INTEGER NOT NULL,
    "productVariantId" TEXT,
    "uom" "StockUom" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qtyReceived" DECIMAL(14,3) NOT NULL,
    "qtyRemaining" DECIMAL(14,3) NOT NULL,
    "sourceMovementLineId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockAllocation" (
    "id" TEXT NOT NULL,
    "stockLotId" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "saleLineId" TEXT,
    "stockMovementLineId" TEXT,
    "productVariantId" TEXT,

    CONSTRAINT "StockAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "movementType" "StockMovementType" NOT NULL,
    "status" "StockMovementStatus" NOT NULL DEFAULT 'DRAFT',
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
    "receiverValidatedByUserId" TEXT,
    "receiverValidatedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovementLine" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "productVariantId" TEXT,
    "voucherQty" DECIMAL(14,3) NOT NULL,
    "actualQty" DECIMAL(14,3),
    "postedQty" DECIMAL(14,3),
    "note" TEXT,

    CONSTRAINT "StockMovementLine_pkey" PRIMARY KEY ("id")
);

-- BpoStockMovement -> StockMovement (before lots that reference movement lines)
INSERT INTO "StockMovement" (
    "id", "movementType", "status", "voucherNo", "sourceSalesPointId", "destinationSalesPointId",
    "movementDate", "reason", "note", "discrepancyNote", "createdByUserId",
    "senderValidatedByUserId", "senderValidatedAt", "receiverValidatedByUserId", "receiverValidatedAt",
    "rejectedAt", "rejectedReason", "postedAt", "createdAt", "updatedAt"
)
SELECT
    m."id",
    CASE m."movementType"
        WHEN 'CONSIGNMENT_TRANSFER' THEN 'TRANSFER'::"StockMovementType"
        WHEN 'GIFT' THEN 'ISSUE_GIFT'::"StockMovementType"
        WHEN 'OTHER_OUT' THEN 'ISSUE_OTHER'::"StockMovementType"
    END,
    m."status"::text::"StockMovementStatus",
    m."voucherNo",
    m."sourceSalesPointId",
    m."destinationSalesPointId",
    m."movementDate",
    m."reason",
    m."note",
    m."discrepancyNote",
    m."createdByUserId",
    m."senderValidatedByUserId",
    m."senderValidatedAt",
    m."botaValidatedByUserId",
    m."botaValidatedAt",
    m."rejectedAt",
    m."rejectedReason",
    m."postedAt",
    m."createdAt",
    m."updatedAt"
FROM "BpoStockMovement" m;

-- BpoStockMovementLine -> StockMovementLine
INSERT INTO "StockMovementLine" (
    "id", "movementId", "productId", "productVariantId",
    "voucherQty", "actualQty", "postedQty", "note"
)
SELECT
    l."id", l."movementId", pv."productId", l."productVariantId",
    l."voucherQtyUnits", l."actualQtyUnits", l."postedQtyUnits", l."note"
FROM "BpoStockMovementLine" l
JOIN "ProductVariant" pv ON pv."id" = l."productVariantId";

-- Migrate Batch -> StockLot
INSERT INTO "StockLot" (
    "id", "salesPointId", "storageLocationId", "productId", "productVariantId",
    "uom", "receivedAt", "qtyReceived", "qtyRemaining", "note", "createdAt", "updatedAt"
)
SELECT
    "id", "salesPointId", "storageLocationId", "productId", NULL,
    'KG'::"StockUom", "receivedAt", "qtyReceivedKg", "qtyRemainingKg", "note", "createdAt", "updatedAt"
FROM "Batch";

-- Migrate BpoStockBatch -> StockLot (preserve ids)
INSERT INTO "StockLot" (
    "id", "salesPointId", "storageLocationId", "productId", "productVariantId",
    "uom", "receivedAt", "qtyReceived", "qtyRemaining", "sourceMovementLineId", "note", "createdAt", "updatedAt"
)
SELECT
    b."id", b."salesPointId", NULL, pv."productId", b."productVariantId",
    'UNIT'::"StockUom", b."receivedAt", b."qtyReceivedUnits", b."qtyRemainingUnits", b."sourceMovementLineId", b."note", b."createdAt", b."updatedAt"
FROM "BpoStockBatch" b
JOIN "ProductVariant" pv ON pv."id" = b."productVariantId";

-- SaleLineBatchAllocation -> StockAllocation
INSERT INTO "StockAllocation" ("id", "stockLotId", "qty", "saleLineId", "stockMovementLineId", "productVariantId")
SELECT
    "id", "batchId", "qtyKg", "saleLineId", NULL, NULL
FROM "SaleLineBatchAllocation";

-- BpoSaleLineBatchAllocation -> StockAllocation
INSERT INTO "StockAllocation" ("id", "stockLotId", "qty", "saleLineId", "stockMovementLineId", "productVariantId")
SELECT
    "id", "batchId", "qtyUnits", "saleLineId", NULL, "productVariantId"
FROM "BpoSaleLineBatchAllocation";

-- FKs and indexes
CREATE UNIQUE INDEX "StockMovement_voucherNo_key" ON "StockMovement"("voucherNo");
CREATE INDEX "StockLot_salesPointId_storageLocationId_productId_productVarian_idx" ON "StockLot"("salesPointId", "storageLocationId", "productId", "productVariantId", "receivedAt");
CREATE INDEX "StockLot_salesPointId_productId_productVariantId_receivedAt_idx" ON "StockLot"("salesPointId", "productId", "productVariantId", "receivedAt");
CREATE INDEX "StockLot_productId_productVariantId_receivedAt_idx" ON "StockLot"("productId", "productVariantId", "receivedAt");
CREATE UNIQUE INDEX "StockAllocation_saleLineId_stockLotId_key" ON "StockAllocation"("saleLineId", "stockLotId");
CREATE INDEX "StockAllocation_stockLotId_idx" ON "StockAllocation"("stockLotId");
CREATE INDEX "StockAllocation_stockMovementLineId_idx" ON "StockAllocation"("stockMovementLineId");
CREATE INDEX "StockAllocation_productVariantId_idx" ON "StockAllocation"("productVariantId");
CREATE INDEX "StockMovement_movementType_status_movementDate_idx" ON "StockMovement"("movementType", "status", "movementDate");
CREATE INDEX "StockMovement_sourceSalesPointId_status_idx" ON "StockMovement"("sourceSalesPointId", "status");
CREATE INDEX "StockMovement_destinationSalesPointId_status_idx" ON "StockMovement"("destinationSalesPointId", "status");
CREATE INDEX "StockMovementLine_movementId_idx" ON "StockMovementLine"("movementId");
CREATE INDEX "StockMovementLine_productId_idx" ON "StockMovementLine"("productId");
CREATE INDEX "StockMovementLine_productVariantId_idx" ON "StockMovementLine"("productVariantId");

ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_salesPointId_fkey" FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_sourceMovementLineId_fkey" FOREIGN KEY ("sourceMovementLineId") REFERENCES "StockMovementLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockAllocation" ADD CONSTRAINT "StockAllocation_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "StockLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockAllocation" ADD CONSTRAINT "StockAllocation_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAllocation" ADD CONSTRAINT "StockAllocation_stockMovementLineId_fkey" FOREIGN KEY ("stockMovementLineId") REFERENCES "StockMovementLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockAllocation" ADD CONSTRAINT "StockAllocation_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sourceSalesPointId_fkey" FOREIGN KEY ("sourceSalesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_destinationSalesPointId_fkey" FOREIGN KEY ("destinationSalesPointId") REFERENCES "SalesPoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_senderValidatedByUserId_fkey" FOREIGN KEY ("senderValidatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_receiverValidatedByUserId_fkey" FOREIGN KEY ("receiverValidatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockMovementLine" ADD CONSTRAINT "StockMovementLine_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "StockMovement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovementLine" ADD CONSTRAINT "StockMovementLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovementLine" ADD CONSTRAINT "StockMovementLine_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop legacy tables
DROP TABLE "SaleLineBatchAllocation";
DROP TABLE "BpoSaleLineBatchAllocation";
DROP TABLE "Batch";
DROP TABLE "BpoStockBatch";
DROP TABLE "BpoStockMovementLine";
DROP TABLE "BpoStockMovement";

DROP TYPE "BpoMovementType";
DROP TYPE "BpoMovementStatus";
