-- Revoke sales invoice validation from senior supervisor and manager line roles.
UPDATE "CommercialServiceRolePermission" csrp
SET "allowed" = false, "updatedAt" = NOW()
FROM "CommercialServiceRole" csr
WHERE csrp."commercialServiceRoleId" = csr.id
  AND csrp.key = 'ui:validate-documents'
  AND (
    LOWER(csr.code) LIKE '%manager%'
    OR (LOWER(csr.code) LIKE '%senior%' AND LOWER(csr.code) LIKE '%supervisor%')
  );

-- Ensure plain supervisor line roles can validate sales invoices.
INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csr.id || 'ui:validate-documents'),
  csr.id,
  'ui:validate-documents',
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
WHERE LOWER(csr.code) LIKE '%supervisor%'
  AND LOWER(csr.code) NOT LIKE '%senior%'
  AND LOWER(csr.code) NOT LIKE '%manager%'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET "allowed" = true, "updatedAt" = NOW();

-- Revoke from legacy SENIOR_SUPERVISOR enum permission rows when explicitly stored.
UPDATE "RolePermission"
SET "allowed" = false, "updatedAt" = NOW()
WHERE "role" = 'SENIOR_SUPERVISOR'::"UserRole"
  AND "key" = 'ui:validate-documents';
