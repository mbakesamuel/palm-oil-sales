-- Drop legacy product stock flags (replaced by Product.form).
ALTER TABLE "Product" DROP COLUMN IF EXISTS "isBottledPalmOil";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "stockTracking";

DROP TYPE IF EXISTS "StockTracking";
