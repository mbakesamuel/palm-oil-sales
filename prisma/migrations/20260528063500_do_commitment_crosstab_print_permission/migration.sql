-- Add explicit permission key for /reports/do-commitment-crosstab/print
-- and grant it wherever the parent report route is already granted.

-- 1) Mirror legacy role permissions (RolePermission).
INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || rp."role"::text || 'route:/reports/do-commitment-crosstab/print'),
  rp."role",
  'route:/reports/do-commitment-crosstab/print',
  rp."allowed",
  NOW(),
  NOW()
FROM "RolePermission" rp
WHERE rp."key" = 'route:/reports/do-commitment-crosstab'
ON CONFLICT ("role", "key") DO UPDATE
SET "allowed" = EXCLUDED."allowed", "updatedAt" = NOW();

-- Ensure sales clerks can open the print route.
INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || 'CLERK' || 'route:/reports/do-commitment-crosstab/print'),
  'CLERK'::"UserRole",
  'route:/reports/do-commitment-crosstab/print',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "RolePermission" rp
  WHERE rp."role" = 'CLERK'::"UserRole"
    AND rp."key" = 'route:/reports/do-commitment-crosstab/print'
);

-- 2) Mirror commercial service role permissions (CommercialServiceRolePermission).
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csrp."commercialServiceRoleId" || 'route:/reports/do-commitment-crosstab/print'),
  csrp."commercialServiceRoleId",
  'route:/reports/do-commitment-crosstab/print',
  csrp."allowed",
  NOW(),
  NOW()
FROM "CommercialServiceRolePermission" csrp
WHERE csrp."key" = 'route:/reports/do-commitment-crosstab'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE
SET "allowed" = EXCLUDED."allowed", "updatedAt" = NOW();

-- Ensure sales-point clerks can open the print route (covers service-role clerks).
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csr.id || 'route:/reports/do-commitment-crosstab/print'),
  csr.id,
  'route:/reports/do-commitment-crosstab/print',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
JOIN "CommercialService" cs ON cs.id = csr."commercialServiceId"
WHERE cs."siteKind" = 'SALES_POINT'
  AND LOWER(csr."code") LIKE '%clerk%'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE
SET "allowed" = true, "updatedAt" = NOW();

-- 3) Mirror global role permissions (GlobalRolePermission).
INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grp."globalRoleDefinitionId" || 'route:/reports/do-commitment-crosstab/print'),
  grp."globalRoleDefinitionId",
  'route:/reports/do-commitment-crosstab/print',
  grp."allowed",
  NOW(),
  NOW()
FROM "GlobalRolePermission" grp
WHERE grp."key" = 'route:/reports/do-commitment-crosstab'
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE
SET "allowed" = EXCLUDED."allowed", "updatedAt" = NOW();

