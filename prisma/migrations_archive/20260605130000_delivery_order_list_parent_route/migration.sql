-- Roles with delivery-order list access also need the parent route for print
-- and server actions (list page asserts both keys). Covers custom clerk codes
-- such as "sac" that were missed by the clerk-code-only migration.

UPDATE "CommercialServiceRolePermission" parent
SET "allowed" = true, "updatedAt" = NOW()
FROM "CommercialServiceRolePermission" child
WHERE parent."commercialServiceRoleId" = child."commercialServiceRoleId"
  AND parent."key" = 'route:/delivery-orders'
  AND child."key" = 'route:/delivery-orders/list'
  AND child."allowed" = true
  AND parent."allowed" = false;

INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || child."commercialServiceRoleId" || 'route:/delivery-orders'),
  child."commercialServiceRoleId",
  'route:/delivery-orders',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRolePermission" child
WHERE child."key" = 'route:/delivery-orders/list'
  AND child."allowed" = true
  AND NOT EXISTS (
    SELECT 1
    FROM "CommercialServiceRolePermission" parent
    WHERE parent."commercialServiceRoleId" = child."commercialServiceRoleId"
      AND parent."key" = 'route:/delivery-orders'
  )
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();

UPDATE "RolePermission" parent
SET "allowed" = true, "updatedAt" = NOW()
FROM "RolePermission" child
WHERE parent."role" = child."role"
  AND parent."key" = 'route:/delivery-orders'
  AND child."key" = 'route:/delivery-orders/list'
  AND child."allowed" = true
  AND parent."allowed" = false;
