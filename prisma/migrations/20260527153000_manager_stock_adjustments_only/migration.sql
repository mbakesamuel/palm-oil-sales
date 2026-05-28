-- Managers use /stock for adjustments only; revoke full stock route access by default.
UPDATE "RolePermission"
SET "allowed" = false, "updatedAt" = NOW()
WHERE "role" = 'MANAGER' AND "key" = 'route:/stock';

UPDATE "GlobalRolePermission" grp
SET "allowed" = false, "updatedAt" = NOW()
FROM "GlobalRoleDefinition" grd
WHERE grp."globalRoleDefinitionId" = grd.id
  AND grd."legacyRole" = 'MANAGER'
  AND grp."key" = 'route:/stock';
