-- Line manager commercial roles should use UserRole.MANAGER, not SENIOR_SUPERVISOR.
UPDATE "User" u
SET "role" = 'MANAGER'::"UserRole", "updatedAt" = NOW()
FROM "CommercialServiceRole" csr
WHERE u."commercialServiceRoleId" = csr.id
  AND LOWER(csr.code) LIKE '%manager%'
  AND LOWER(csr.code) NOT LIKE '%factory%'
  AND u."role" = 'SENIOR_SUPERVISOR';

-- Line staff must not keep a global role row (it overrides session.role in the UI).
UPDATE "User"
SET "globalRoleDefinitionId" = NULL, "updatedAt" = NOW()
WHERE "commercialServiceRoleId" IS NOT NULL
  AND "globalRoleDefinitionId" IS NOT NULL;
