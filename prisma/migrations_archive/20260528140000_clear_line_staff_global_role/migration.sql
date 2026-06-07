-- Line staff must not keep a global role (it overrode session.role with Senior sales supervisor).
UPDATE "User"
SET "globalRoleDefinitionId" = NULL, "updatedAt" = NOW()
WHERE "commercialServiceRoleId" IS NOT NULL
  AND "globalRoleDefinitionId" IS NOT NULL;
