-- Remove inventory / stock management tables and enums.
DROP TABLE IF EXISTS "StockAllocation" CASCADE;
DROP TABLE IF EXISTS "StockMovementLine" CASCADE;
DROP TABLE IF EXISTS "StockLot" CASCADE;
DROP TABLE IF EXISTS "StockMovement" CASCADE;
-- Keep StorageLocation: required by 20260521180000_unified_stock (StockLot FK) and later migrations.

DROP TYPE IF EXISTS "StockMovementStatus";
DROP TYPE IF EXISTS "StockMovementType";
DROP TYPE IF EXISTS "StockUom";
