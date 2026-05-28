-- Sales clerks no longer hold the post-stock-receipt / dispatch-stock-transfer
-- permissions: those become the supervisor-level validation step (mirrors how sales
-- invoices are drafted by clerks and validated by supervisors). Receive-transfer is
-- left untouched because clerks still confirm arrival at the destination sales point.
--
-- Affected role keys:
--   * Global UserRole = 'CLERK'
--   * Commercial service roles whose `code` IN ('clerk', 'factory_clerk')
-- All other roles (supervisors, managers, BPO clerk in charge, factory supervisors,
-- etc.) keep their existing permission rows untouched.

-- 1) Global per-role permissions (UserRole.CLERK).
UPDATE "RolePermission"
SET "allowed" = false, "updatedAt" = NOW()
WHERE "role" = 'CLERK'
  AND "key" IN ('ui:post-stock-receipt', 'ui:dispatch-stock-transfer')
  AND "allowed" = true;

-- 2) Global role definitions that map back to UserRole.CLERK via `legacyRole`.
UPDATE "GlobalRolePermission" grp
SET "allowed" = false, "updatedAt" = NOW()
FROM "GlobalRoleDefinition" grd
WHERE grp."globalRoleDefinitionId" = grd."id"
  AND grd."legacyRole" = 'CLERK'
  AND grp."key" IN ('ui:post-stock-receipt', 'ui:dispatch-stock-transfer')
  AND grp."allowed" = true;

-- 3) Commercial-service "Sales clerk" / "Factory clerk" roles.
UPDATE "CommercialServiceRolePermission" csrp
SET "allowed" = false, "updatedAt" = NOW()
FROM "CommercialServiceRole" csr
WHERE csrp."commercialServiceRoleId" = csr."id"
  AND csr."code" IN ('clerk', 'factory_clerk')
  AND csrp."key" IN ('ui:post-stock-receipt', 'ui:dispatch-stock-transfer')
  AND csrp."allowed" = true;
