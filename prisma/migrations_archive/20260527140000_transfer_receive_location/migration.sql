-- Destination storage location is chosen by the receiver at receipt, not at draft.

ALTER TABLE "StockTransferLine" ALTER COLUMN "toStorageLocationId" DROP NOT NULL;

UPDATE "StockTransferLine" stl
SET "toStorageLocationId" = NULL
FROM "StockTransfer" st
WHERE st.id = stl."transferId"
  AND st.status IN ('DRAFT', 'DISPATCHED');
