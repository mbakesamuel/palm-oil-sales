-- Explicit permission for the daily sales summary print route (mirrors the report route).

INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || rp."role"::text || 'route:/reports/daily-sales-summary/print'),
  rp."role",
  'route:/reports/daily-sales-summary/print',
  rp."allowed",
  NOW(),
  NOW()
FROM "RolePermission" rp
WHERE rp."key" = 'route:/reports/daily-sales-summary'
ON CONFLICT ("role", "key") DO UPDATE SET "allowed" = EXCLUDED."allowed", "updatedAt" = NOW();

INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csrp."commercialServiceRoleId" || 'route:/reports/daily-sales-summary/print'),
  csrp."commercialServiceRoleId",
  'route:/reports/daily-sales-summary/print',
  csrp."allowed",
  NOW(),
  NOW()
FROM "CommercialServiceRolePermission" csrp
WHERE csrp."key" = 'route:/reports/daily-sales-summary'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET "allowed" = EXCLUDED."allowed", "updatedAt" = NOW();

-- Sales-point line roles that can open the report but had no parent row yet.
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csr.id || 'route:/reports/daily-sales-summary/print'),
  csr.id,
  'route:/reports/daily-sales-summary/print',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
JOIN "CommercialService" cs ON cs.id = csr."commercialServiceId"
WHERE cs."siteKind" = 'SALES_POINT'
  AND LOWER(csr."code") NOT LIKE 'factory%'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET "allowed" = true, "updatedAt" = NOW();

INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grp."globalRoleDefinitionId" || 'route:/reports/daily-sales-summary/print'),
  grp."globalRoleDefinitionId",
  'route:/reports/daily-sales-summary/print',
  grp."allowed",
  NOW(),
  NOW()
FROM "GlobalRolePermission" grp
WHERE grp."key" = 'route:/reports/daily-sales-summary'
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET "allowed" = EXCLUDED."allowed", "updatedAt" = NOW();
