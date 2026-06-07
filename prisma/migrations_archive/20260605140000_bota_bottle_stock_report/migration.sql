-- Bota bottle stock ledger report for sales-point line roles on palm lines.

INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csr.id || 'route:/reports/bota-bottle-stock'),
  csr.id,
  'route:/reports/bota-bottle-stock',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
JOIN "CommercialService" cs ON cs.id = csr."commercialServiceId"
WHERE cs."siteKind" = 'SALES_POINT'
  AND LOWER(csr."code") NOT LIKE 'factory%'
  AND csr."isActive" = true
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();

INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || rp."role"::text || 'route:/reports/bota-bottle-stock'),
  rp."role",
  'route:/reports/bota-bottle-stock',
  rp."allowed",
  NOW(),
  NOW()
FROM "RolePermission" rp
WHERE rp."key" = 'route:/reports/stock-inquiry'
ON CONFLICT ("role", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grp."globalRoleDefinitionId" || 'route:/reports/bota-bottle-stock'),
  grp."globalRoleDefinitionId",
  'route:/reports/bota-bottle-stock',
  grp."allowed",
  NOW(),
  NOW()
FROM "GlobalRolePermission" grp
WHERE grp."key" = 'route:/reports/stock-inquiry'
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();
