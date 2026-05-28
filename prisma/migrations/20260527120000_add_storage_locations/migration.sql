-- Storage locations per sales point; stock balances and movements track per location.

CREATE TABLE "StorageLocation" (
    "id" SERIAL NOT NULL,
    "salesPointId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageLocation_salesPointId_name_key" ON "StorageLocation"("salesPointId", "name");
CREATE INDEX "StorageLocation_salesPointId_idx" ON "StorageLocation"("salesPointId");

ALTER TABLE "StorageLocation" ADD CONSTRAINT "StorageLocation_salesPointId_fkey" FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "StorageLocation" ("salesPointId", "name", "isDefault", "updatedAt")
SELECT id, 'General', true, CURRENT_TIMESTAMP FROM "SalesPoint";

-- StockBalance: extend primary key with storageLocationId
ALTER TABLE "StockBalance" ADD COLUMN "storageLocationId" INTEGER;

UPDATE "StockBalance" sb
SET "storageLocationId" = (
    SELECT sl.id
    FROM "StorageLocation" sl
    WHERE sl."salesPointId" = sb."salesPointId" AND sl."isDefault" = true
    LIMIT 1
);

ALTER TABLE "StockBalance" ALTER COLUMN "storageLocationId" SET NOT NULL;

ALTER TABLE "StockBalance" DROP CONSTRAINT "StockBalance_pkey";
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("salesPointId", "productId", "storageLocationId");
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "StockBalance_storageLocationId_idx" ON "StockBalance"("storageLocationId");

-- StockMovement
ALTER TABLE "StockMovement" ADD COLUMN "storageLocationId" INTEGER;

UPDATE "StockMovement" sm
SET "storageLocationId" = (
    SELECT sl.id
    FROM "StorageLocation" sl
    WHERE sl."salesPointId" = sm."salesPointId" AND sl."isDefault" = true
    LIMIT 1
);

ALTER TABLE "StockMovement" ALTER COLUMN "storageLocationId" SET NOT NULL;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "StockMovement_storageLocationId_productId_idx" ON "StockMovement"("storageLocationId", "productId");

-- StockReceiptLine
ALTER TABLE "StockReceiptLine" ADD COLUMN "storageLocationId" INTEGER;

UPDATE "StockReceiptLine" srl
SET "storageLocationId" = (
    SELECT sl.id
    FROM "StorageLocation" sl
    INNER JOIN "StockReceipt" sr ON sr."salesPointId" = sl."salesPointId"
    WHERE sr.id = srl."receiptId" AND sl."isDefault" = true
    LIMIT 1
);

ALTER TABLE "StockReceiptLine" ALTER COLUMN "storageLocationId" SET NOT NULL;
ALTER TABLE "StockReceiptLine" ADD CONSTRAINT "StockReceiptLine_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "StockReceiptLine_storageLocationId_idx" ON "StockReceiptLine"("storageLocationId");

-- StockAdjustmentLine
ALTER TABLE "StockAdjustmentLine" ADD COLUMN "storageLocationId" INTEGER;

UPDATE "StockAdjustmentLine" sal
SET "storageLocationId" = (
    SELECT sl.id
    FROM "StorageLocation" sl
    INNER JOIN "StockAdjustment" sa ON sa."salesPointId" = sl."salesPointId"
    WHERE sa.id = sal."adjustmentId" AND sl."isDefault" = true
    LIMIT 1
);

ALTER TABLE "StockAdjustmentLine" ALTER COLUMN "storageLocationId" SET NOT NULL;
ALTER TABLE "StockAdjustmentLine" ADD CONSTRAINT "StockAdjustmentLine_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "StockAdjustmentLine_storageLocationId_idx" ON "StockAdjustmentLine"("storageLocationId");

-- StockTransferLine
ALTER TABLE "StockTransferLine" ADD COLUMN "fromStorageLocationId" INTEGER;
ALTER TABLE "StockTransferLine" ADD COLUMN "toStorageLocationId" INTEGER;

UPDATE "StockTransferLine" stl
SET
    "fromStorageLocationId" = (
        SELECT sl.id
        FROM "StorageLocation" sl
        INNER JOIN "StockTransfer" st ON st."fromSalesPointId" = sl."salesPointId"
        WHERE st.id = stl."transferId" AND sl."isDefault" = true
        LIMIT 1
    ),
    "toStorageLocationId" = (
        SELECT sl.id
        FROM "StorageLocation" sl
        INNER JOIN "StockTransfer" st ON st."toSalesPointId" = sl."salesPointId"
        WHERE st.id = stl."transferId" AND sl."isDefault" = true
        LIMIT 1
    );

ALTER TABLE "StockTransferLine" ALTER COLUMN "fromStorageLocationId" SET NOT NULL;
ALTER TABLE "StockTransferLine" ALTER COLUMN "toStorageLocationId" SET NOT NULL;
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_fromStorageLocationId_fkey" FOREIGN KEY ("fromStorageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_toStorageLocationId_fkey" FOREIGN KEY ("toStorageLocationId") REFERENCES "StorageLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
