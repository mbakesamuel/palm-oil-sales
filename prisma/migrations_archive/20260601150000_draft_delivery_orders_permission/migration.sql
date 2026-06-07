-- Draft delivery orders: DB permission aligned with Role access / User access control.

-- Line roles whose code indicates senior supervisor.
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  csr.id,
  'ui:draft-delivery-orders',
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

-- Global roles mapped to legacy SENIOR_SUPERVISOR.
INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  grd.id,
  'ui:draft-delivery-orders',
  true,
  NOW(),
  NOW()
FROM "GlobalRoleDefinition" grd
WHERE grd."isActive" = true
  AND grd."legacyRole" = 'SENIOR_SUPERVISOR'
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();

-- Roles that can open delivery orders but do not validate them (typical senior drafters).
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  csr.id,
  'ui:draft-delivery-orders',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
WHERE csr."isActive" = true
  AND EXISTS (
    SELECT 1 FROM "CommercialServiceRolePermission" p
    WHERE p."commercialServiceRoleId" = csr.id
      AND p."key" = 'route:/delivery-orders'
      AND p."allowed" = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM "CommercialServiceRolePermission" p
    WHERE p."commercialServiceRoleId" = csr.id
      AND p."key" = 'ui:validate-delivery-orders'
      AND p."allowed" = true
  )
  AND NOT EXISTS (
    SELECT 1 FROM "CommercialServiceRolePermission" p
    WHERE p."commercialServiceRoleId" = csr.id
      AND p."key" = 'ui:validate-documents'
      AND p."allowed" = true
  )
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();
