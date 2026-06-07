-- Daily sales crosstab report (day × customer category per sales point).

INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csr.id || 'route:/reports/daily-sales-crosstab'),
  csr.id,
  'route:/reports/daily-sales-crosstab',
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
  md5(random()::text || rp."role"::text || 'route:/reports/daily-sales-crosstab'),
  rp."role",
  'route:/reports/daily-sales-crosstab',
  rp."allowed",
  NOW(),
  NOW()
FROM "RolePermission" rp
WHERE rp."key" = 'route:/reports/daily-sales-summary'
ON CONFLICT ("role", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grp."globalRoleDefinitionId" || 'route:/reports/daily-sales-crosstab'),
  grp."globalRoleDefinitionId",
  'route:/reports/daily-sales-crosstab',
  grp."allowed",
  NOW(),
  NOW()
FROM "GlobalRolePermission" grp
WHERE grp."key" = 'route:/reports/daily-sales-summary'
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || rp."role"::text || 'route:/reports/daily-sales-crosstab/print'),
  rp."role",
  'route:/reports/daily-sales-crosstab/print',
  rp."allowed",
  NOW(),
  NOW()
FROM "RolePermission" rp
WHERE rp."key" = 'route:/reports/daily-sales-crosstab'
ON CONFLICT ("role", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csrp."commercialServiceRoleId" || 'route:/reports/daily-sales-crosstab/print'),
  csrp."commercialServiceRoleId",
  'route:/reports/daily-sales-crosstab/print',
  csrp."allowed",
  NOW(),
  NOW()
FROM "CommercialServiceRolePermission" csrp
WHERE csrp."key" = 'route:/reports/daily-sales-crosstab'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grp."globalRoleDefinitionId" || 'route:/reports/daily-sales-crosstab/print'),
  grp."globalRoleDefinitionId",
  'route:/reports/daily-sales-crosstab/print',
  grp."allowed",
  NOW(),
  NOW()
FROM "GlobalRolePermission" grp
WHERE grp."key" = 'route:/reports/daily-sales-crosstab'
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();
