-- Global roles: id + code (CRUD in UI), permissions on GlobalRolePermission.

CREATE TABLE "GlobalRolePermission" (
    "id" TEXT NOT NULL,
    "globalRoleDefinitionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalRolePermission_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GlobalRoleDefinition" ADD COLUMN "id" TEXT;
ALTER TABLE "GlobalRoleDefinition" ADD COLUMN "code" TEXT;
ALTER TABLE "GlobalRoleDefinition" ADD COLUMN "legacyRole" "UserRole";

UPDATE "GlobalRoleDefinition"
SET
    "legacyRole" = "role",
    "code" = LOWER("role"::text),
    "id" = gen_random_uuid()::text;

ALTER TABLE "GlobalRoleDefinition" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "GlobalRoleDefinition" ALTER COLUMN "code" SET NOT NULL;

ALTER TABLE "GlobalRoleDefinition" DROP CONSTRAINT "GlobalRoleDefinition_pkey";
ALTER TABLE "GlobalRoleDefinition" DROP COLUMN "role";

ALTER TABLE "GlobalRoleDefinition" ADD CONSTRAINT "GlobalRoleDefinition_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "GlobalRoleDefinition_code_key" ON "GlobalRoleDefinition"("code");
CREATE UNIQUE INDEX "GlobalRoleDefinition_legacyRole_key" ON "GlobalRoleDefinition"("legacyRole");

ALTER TABLE "User" ADD COLUMN "globalRoleDefinitionId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_globalRoleDefinitionId_fkey"
    FOREIGN KEY ("globalRoleDefinitionId") REFERENCES "GlobalRoleDefinition"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_globalRoleDefinitionId_idx" ON "User"("globalRoleDefinitionId");

UPDATE "User" u
SET "globalRoleDefinitionId" = g."id"
FROM "GlobalRoleDefinition" g
WHERE g."legacyRole" = u."role"
  AND u."role" IN ('ADMIN', 'DIRECTOR', 'MANAGER', 'OFFICER');

CREATE UNIQUE INDEX "GlobalRolePermission_globalRoleDefinitionId_key_key"
    ON "GlobalRolePermission"("globalRoleDefinitionId", "key");

CREATE INDEX "GlobalRolePermission_key_idx" ON "GlobalRolePermission"("key");

ALTER TABLE "GlobalRolePermission" ADD CONSTRAINT "GlobalRolePermission_globalRoleDefinitionId_fkey"
    FOREIGN KEY ("globalRoleDefinitionId") REFERENCES "GlobalRoleDefinition"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
