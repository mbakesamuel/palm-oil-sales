-- Sales clerks: open the delivery order list, print individual DOs, and print the DO report.

-- 1) Legacy UserRole.CLERK
INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || 'CLERK' || k.key),
  'CLERK'::"UserRole",
  k.key,
  true,
  NOW(),
  NOW()
FROM (
  VALUES
    ('route:/delivery-orders'),
    ('route:/delivery-orders/list'),
    ('route:/reports/delivery-orders'),
    ('route:/reports/delivery-orders/print')
) AS k(key)
ON CONFLICT ("role", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();

-- 2) Sales-point clerk line roles
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csr.id || k.key),
  csr.id,
  k.key,
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
JOIN "CommercialService" cs ON cs.id = csr."commercialServiceId"
CROSS JOIN (
  VALUES
    ('route:/delivery-orders'),
    ('route:/delivery-orders/list'),
    ('route:/reports/delivery-orders'),
    ('route:/reports/delivery-orders/print')
) AS k(key)
WHERE cs."siteKind" = 'SALES_POINT'
  AND LOWER(csr."code") = 'clerk'
  AND csr."isActive" = true
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();

-- 3) Mirror delivery-orders report print wherever the parent report is already granted.
INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || rp."role"::text || 'route:/reports/delivery-orders/print'),
  rp."role",
  'route:/reports/delivery-orders/print',
  rp."allowed",
  NOW(),
  NOW()
FROM "RolePermission" rp
WHERE rp."key" = 'route:/reports/delivery-orders'
ON CONFLICT ("role", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csrp."commercialServiceRoleId" || 'route:/reports/delivery-orders/print'),
  csrp."commercialServiceRoleId",
  'route:/reports/delivery-orders/print',
  csrp."allowed",
  NOW(),
  NOW()
FROM "CommercialServiceRolePermission" csrp
WHERE csrp."key" = 'route:/reports/delivery-orders'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grp."globalRoleDefinitionId" || 'route:/reports/delivery-orders/print'),
  grp."globalRoleDefinitionId",
  'route:/reports/delivery-orders/print',
  grp."allowed",
  NOW(),
  NOW()
FROM "GlobalRolePermission" grp
WHERE grp."key" = 'route:/reports/delivery-orders'
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();
