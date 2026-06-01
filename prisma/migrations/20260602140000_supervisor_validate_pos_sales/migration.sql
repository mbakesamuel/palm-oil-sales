-- Line supervisors must validate clerk POS drafts (ensure permission row exists and is allowed).

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
  AND LOWER(csr."code") LIKE '%supervisor%'
  AND LOWER(csr."code") NOT LIKE '%senior%'
  AND LOWER(csr."code") NOT LIKE '%manager%'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();
