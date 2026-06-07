-- Seeds the four canonical palm oil product categories used across the business:
--   Loose Palm Oil (LPO)               -- intended Main once the legacy "Primary"
--                                          row is retired by an admin via the UI.
--   Bottle Palm Oil (BPO)
--   Palm Kernel Product (PKP)
--   Bottom Tank / Palm Sludge Oil (PSO)
--
-- All four rows are inserted as isMain = false because the partial unique index
-- ProductCat_isMain_unique enforces a single Main row at any time and the
-- legacy "Primary" (productCatId = 3) still holds it. After product
-- re-classification, an admin can clear the legacy row's Main flag and toggle
-- LPO -> Main from /product-categories.
--
-- The migration is idempotent: each row is inserted only if a category with the
-- same productCode is not already present.

INSERT INTO "ProductCat" ("productCat", "productCode", "isMain", "updatedAt")
SELECT 'Loose Palm Oil', 'LPO', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductCat" WHERE "productCode" = 'LPO'
);

INSERT INTO "ProductCat" ("productCat", "productCode", "isMain", "updatedAt")
SELECT 'Bottle Palm Oil', 'BPO', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductCat" WHERE "productCode" = 'BPO'
);

INSERT INTO "ProductCat" ("productCat", "productCode", "isMain", "updatedAt")
SELECT 'Palm Kernel Product', 'PKP', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductCat" WHERE "productCode" = 'PKP'
);

INSERT INTO "ProductCat" ("productCat", "productCode", "isMain", "updatedAt")
SELECT 'Bottom Tank/Palm Sludge Oil', 'PSO', false, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductCat" WHERE "productCode" = 'PSO'
);
