ALTER TABLE "StockAdjustmentLine"
ADD COLUMN IF NOT EXISTS "fromCondition" "StockCondition",
ADD COLUMN IF NOT EXISTS "toCondition" "StockCondition";

