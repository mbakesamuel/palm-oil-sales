-- Remove inventory / stock management tables and enums.
DROP TABLE IF EXISTS "StockAllocation" CASCADE;
DROP TABLE IF EXISTS "StockMovementLine" CASCADE;
DROP TABLE IF EXISTS "StockLot" CASCADE;
DROP TABLE IF EXISTS "StockMovement" CASCADE;
DROP TABLE IF EXISTS "StorageLocation" CASCADE;

DROP TYPE IF EXISTS "StockMovementStatus";
DROP TYPE IF EXISTS "StockMovementType";
DROP TYPE IF EXISTS "StockUom";
