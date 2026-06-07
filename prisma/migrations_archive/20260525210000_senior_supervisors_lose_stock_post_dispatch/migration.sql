-- Senior supervisors roam across sales points and therefore do not post receipts
-- or dispatch transfers in place of the responsible sales-point supervisor. This
-- mirrors the new default permissions in `lib/access-control.ts`.
--
-- The receive-stock-transfer permission is intentionally left untouched so a
-- senior supervisor can still confirm physical arrival at a destination when
-- standing in for a clerk.
--
-- Affected role keys:
--   * Global UserRole = 'SENIOR_SUPERVISOR'
--   * Commercial service roles whose `code` contains 'senior' (e.g. 'senior_supervisor',
--     'senior_factory_supervisor', etc.)
-- All other roles keep their existing permission rows untouched.

-- 1) Global per-role permissions (UserRole.SENIOR_SUPERVISOR).
UPDATE "RolePermission"
SET "allowed" = false, "updatedAt" = NOW()
WHERE "role" = 'SENIOR_SUPERVISOR'
  AND "key" IN ('ui:post-stock-receipt', 'ui:dispatch-stock-transfer')
  AND "allowed" = true;

-- 2) Global role definitions that map back to UserRole.SENIOR_SUPERVISOR via `legacyRole`.
UPDATE "GlobalRolePermission" grp
SET "allowed" = false, "updatedAt" = NOW()
FROM "GlobalRoleDefinition" grd
WHERE grp."globalRoleDefinitionId" = grd."id"
  AND grd."legacyRole" = 'SENIOR_SUPERVISOR'
  AND grp."key" IN ('ui:post-stock-receipt', 'ui:dispatch-stock-transfer')
  AND grp."allowed" = true;

-- 3) Commercial-service "Senior * supervisor" roles (any code containing 'senior').
UPDATE "CommercialServiceRolePermission" csrp
SET "allowed" = false, "updatedAt" = NOW()
FROM "CommercialServiceRole" csr
WHERE csrp."commercialServiceRoleId" = csr."id"
  AND LOWER(csr."code") LIKE '%senior%'
  AND csrp."key" IN ('ui:post-stock-receipt', 'ui:dispatch-stock-transfer')
  AND csrp."allowed" = true;
