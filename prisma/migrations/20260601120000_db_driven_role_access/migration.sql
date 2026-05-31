-- Backfill user role definition assignments and grant admin role-access route.

-- Org-wide users (ADMIN, DIRECTOR) without a role definition
UPDATE "User" u
SET "globalRoleDefinitionId" = grd.id
FROM "GlobalRoleDefinition" grd
WHERE u."globalRoleDefinitionId" IS NULL
  AND u."commercialServiceRoleId" IS NULL
  AND u.role IN ('ADMIN', 'DIRECTOR')
  AND grd."legacyRole" = u.role
  AND grd."isActive" = true;

-- Line staff on a commercial service — map User.role to default line role code
UPDATE "User" u
SET "commercialServiceRoleId" = csr.id
FROM "CommercialServiceRole" csr
WHERE u."commercialServiceRoleId" IS NULL
  AND u."globalRoleDefinitionId" IS NULL
  AND u."commercialServiceId" IS NOT NULL
  AND csr."commercialServiceId" = u."commercialServiceId"
  AND csr."isActive" = true
  AND (
    (u.role = 'CLERK' AND csr.code IN ('clerk', 'factory_clerk'))
    OR (u.role = 'SUPERVISOR' AND csr.code IN ('supervisor', 'factory_supervisor'))
    OR (u.role = 'SENIOR_SUPERVISOR' AND csr.code = 'senior_supervisor')
    OR (u.role = 'MANAGER' AND csr.code IN ('manager', 'factory_manager'))
  );

-- Admin global role: full access + new role-access setup route
INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  grd.id,
  k.key,
  true,
  NOW(),
  NOW()
FROM "GlobalRoleDefinition" grd
CROSS JOIN (VALUES ('route:/setup/role-access')) AS k(key)
WHERE grd."legacyRole" = 'ADMIN'
  AND grd."isActive" = true
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();

-- Mobile API for supervisor/manager line roles (preserve prior hardcoded access)
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  csr.id,
  'route:/api/mobile/v1',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
WHERE csr."isActive" = true
  AND (
    csr.code IN ('supervisor', 'senior_supervisor', 'manager', 'factory_supervisor', 'factory_manager')
    OR csr.code LIKE '%supervisor%'
    OR csr.code LIKE '%manager%'
  )
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

-- Mobile for director global role
INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  grd.id,
  'route:/api/mobile/v1',
  true,
  NOW(),
  NOW()
FROM "GlobalRoleDefinition" grd
WHERE grd."legacyRole" = 'DIRECTOR'
  AND grd."isActive" = true
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();
