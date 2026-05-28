-- Org-wide global roles are Admin and Director only. Retire Manager and Officer definitions.

UPDATE "GlobalRoleDefinition"
SET "isActive" = false, "updatedAt" = NOW()
WHERE "legacyRole" IN ('MANAGER', 'OFFICER');

-- Reassign users on retired global roles to Director.
UPDATE "User" u
SET
  "role" = 'DIRECTOR'::"UserRole",
  "globalRoleDefinitionId" = director.id,
  "updatedAt" = NOW()
FROM (
  SELECT id FROM "GlobalRoleDefinition"
  WHERE "legacyRole" = 'DIRECTOR' AND "isActive" = true
  ORDER BY "sortOrder" ASC
  LIMIT 1
) AS director
WHERE u."globalRoleDefinitionId" IN (
  SELECT id FROM "GlobalRoleDefinition" WHERE "legacyRole" IN ('MANAGER', 'OFFICER')
);

-- Org-wide accounts that still use enum MANAGER/OFFICER without a commercial line.
UPDATE "User" u
SET
  "role" = 'DIRECTOR'::"UserRole",
  "globalRoleDefinitionId" = COALESCE(
    u."globalRoleDefinitionId",
    (SELECT id FROM "GlobalRoleDefinition" WHERE "legacyRole" = 'DIRECTOR' AND "isActive" = true LIMIT 1)
  ),
  "updatedAt" = NOW()
WHERE u."role" IN ('MANAGER', 'OFFICER')
  AND u."commercialServiceId" IS NULL;

-- Delivery order validation moves from Manager to Director.
INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grd.id || 'ui:validate-delivery-orders'),
  grd.id,
  'ui:validate-delivery-orders',
  true,
  NOW(),
  NOW()
FROM "GlobalRoleDefinition" grd
WHERE grd."legacyRole" = 'DIRECTOR' AND grd."isActive" = true
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET "allowed" = true, "updatedAt" = NOW();

INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || 'DIRECTOR' || 'ui:validate-delivery-orders'),
  'DIRECTOR'::"UserRole",
  'ui:validate-delivery-orders',
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "RolePermission"
  WHERE "role" = 'DIRECTOR' AND "key" = 'ui:validate-delivery-orders'
);

-- Revoke delivery-order validation from legacy Manager permission rows.
UPDATE "RolePermission"
SET "allowed" = false, "updatedAt" = NOW()
WHERE "role" = 'MANAGER' AND "key" = 'ui:validate-delivery-orders';

UPDATE "GlobalRolePermission" grp
SET "allowed" = false, "updatedAt" = NOW()
FROM "GlobalRoleDefinition" grd
WHERE grp."globalRoleDefinitionId" = grd.id
  AND grd."legacyRole" = 'MANAGER'
  AND grp."key" = 'ui:validate-delivery-orders';
