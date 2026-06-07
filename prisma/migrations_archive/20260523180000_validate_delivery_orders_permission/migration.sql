-- Seed ui:validate-delivery-orders for global MANAGER legacy role permissions.
INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grd.id || 'ui:validate-delivery-orders'),
  grd.id,
  'ui:validate-delivery-orders',
  true,
  NOW(),
  NOW()
FROM "GlobalRoleDefinition" grd
WHERE grd."legacyRole" = 'MANAGER'
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET "allowed" = true, "updatedAt" = NOW();

-- Seed ui:validate-delivery-orders for legacy UserRole.MANAGER permission rows.
INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || 'MANAGER' || 'ui:validate-delivery-orders'),
  'MANAGER'::"UserRole",
  'ui:validate-delivery-orders',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "RolePermission"
  WHERE "role" = 'MANAGER' AND "key" = 'ui:validate-delivery-orders'
);

-- Enable for line roles whose code includes "manager" (line/site managers).
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csr.id || 'ui:validate-delivery-orders'),
  csr.id,
  'ui:validate-delivery-orders',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
WHERE LOWER(csr.code) LIKE '%manager%'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET "allowed" = true, "updatedAt" = NOW();
