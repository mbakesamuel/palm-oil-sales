-- Mobile monitoring: Bota bottle stock ledger for clerks, supervisors, managers, and global roles.

-- 1) Line roles that can open the report also get mobile app sign-in.
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csrp."commercialServiceRoleId" || 'route:/api/mobile/v1'),
  csrp."commercialServiceRoleId",
  'route:/api/mobile/v1',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRolePermission" csrp
JOIN "CommercialServiceRole" csr ON csr.id = csrp."commercialServiceRoleId"
WHERE csrp."key" = 'route:/reports/bota-bottle-stock'
  AND csrp."allowed" = true
  AND csr."isActive" = true
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();

-- 2) Supervisory / management line roles on sales-point lines (incl. custom codes).
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
    ('route:/api/mobile/v1'),
    ('route:/reports/bota-bottle-stock')
) AS k(key)
WHERE cs."siteKind" = 'SALES_POINT'
  AND LOWER(csr."code") NOT LIKE 'factory%'
  AND csr."isActive" = true
  AND (
    LOWER(csr."code") IN ('clerk', 'supervisor', 'senior_supervisor', 'manager')
    OR LOWER(csr."code") LIKE '%supervisor%'
    OR LOWER(csr."code") LIKE '%manager%'
    OR LOWER(csr."name") LIKE '%sales clerk%'
  )
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();

-- 3) Global roles with stock inquiry access (directors, etc.).
INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grp."globalRoleDefinitionId" || k.key),
  grp."globalRoleDefinitionId",
  k.key,
  true,
  NOW(),
  NOW()
FROM "GlobalRolePermission" grp
CROSS JOIN (VALUES ('route:/api/mobile/v1'), ('route:/reports/bota-bottle-stock')) AS k(key)
WHERE grp."key" = 'route:/reports/stock-inquiry'
  AND grp."allowed" = true
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

-- 4) Legacy UserRole rows mirrored from stock inquiry.
INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || rp."role"::text || k.key),
  rp."role",
  k.key,
  rp."allowed",
  NOW(),
  NOW()
FROM "RolePermission" rp
CROSS JOIN (VALUES ('route:/reports/bota-bottle-stock')) AS k(key)
WHERE rp."key" = 'route:/reports/stock-inquiry'
ON CONFLICT ("role", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();
