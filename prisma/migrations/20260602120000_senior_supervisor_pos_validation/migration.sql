-- Senior supervisors validate POS sales but not delivery orders.

-- Grant sales validation to senior supervisor line roles.
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  csr.id,
  'ui:validate-documents',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
WHERE csr."isActive" = true
  AND LOWER(csr."code") LIKE '%senior%'
  AND LOWER(csr."code") LIKE '%supervisor%'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();

-- Grant for global roles mapped to legacy SENIOR_SUPERVISOR.
INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  grd.id,
  'ui:validate-documents',
  true,
  NOW(),
  NOW()
FROM "GlobalRoleDefinition" grd
WHERE grd."isActive" = true
  AND grd."legacyRole" = 'SENIOR_SUPERVISOR'
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();

-- Revoke DO validation from senior supervisor line roles (defensive).
UPDATE "CommercialServiceRolePermission" csrp
SET "allowed" = false, "updatedAt" = NOW()
FROM "CommercialServiceRole" csr
WHERE csrp."commercialServiceRoleId" = csr.id
  AND csrp."key" = 'ui:validate-delivery-orders'
  AND csr."isActive" = true
  AND LOWER(csr."code") LIKE '%senior%'
  AND LOWER(csr."code") LIKE '%supervisor%';

-- Revoke DO validation from global SENIOR_SUPERVISOR legacy permissions.
UPDATE "GlobalRolePermission" grp
SET "allowed" = false, "updatedAt" = NOW()
FROM "GlobalRoleDefinition" grd
WHERE grp."globalRoleDefinitionId" = grd.id
  AND grp."key" = 'ui:validate-delivery-orders'
  AND grd."legacyRole" = 'SENIOR_SUPERVISOR';

-- Revoke from legacy RolePermission rows when explicitly stored.
UPDATE "RolePermission"
SET "allowed" = false, "updatedAt" = NOW()
WHERE "role" = 'SENIOR_SUPERVISOR'::"UserRole"
  AND "key" = 'ui:validate-delivery-orders';
