-- Seed ui:reclassify-stock-condition for global MANAGER and DIRECTOR legacy role permissions.
INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grd.id || 'ui:reclassify-stock-condition'),
  grd.id,
  'ui:reclassify-stock-condition',
  true,
  NOW(),
  NOW()
FROM "GlobalRoleDefinition" grd
WHERE grd."legacyRole" IN ('MANAGER', 'DIRECTOR')
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET "allowed" = true, "updatedAt" = NOW();

-- Seed ui:reclassify-stock-condition for legacy UserRole.MANAGER and DIRECTOR permission rows.
INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || role_name || 'ui:reclassify-stock-condition'),
  role_name::"UserRole",
  'ui:reclassify-stock-condition',
  true,
  NOW(),
  NOW()
FROM (VALUES ('MANAGER'), ('DIRECTOR')) AS roles(role_name)
WHERE NOT EXISTS (
  SELECT 1 FROM "RolePermission" rp
  WHERE rp."role" = roles.role_name::"UserRole"
    AND rp."key" = 'ui:reclassify-stock-condition'
);

-- Enable for line roles whose code includes "manager" or "director".
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csr.id || 'ui:reclassify-stock-condition'),
  csr.id,
  'ui:reclassify-stock-condition',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
WHERE LOWER(csr.code) LIKE '%manager%'
   OR LOWER(csr.code) LIKE '%director%'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET "allowed" = true, "updatedAt" = NOW();
