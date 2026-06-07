-- Retire CLERK_IN_CHARGE_BPO: line staff use CommercialServiceRole (e.g. bpo_clerk) instead.

UPDATE "User"
SET "role" = 'SUPERVISOR'::"UserRole", "updatedAt" = NOW()
WHERE "role" = 'CLERK_IN_CHARGE_BPO'::"UserRole";

DELETE FROM "RolePermission" WHERE "role" = 'CLERK_IN_CHARGE_BPO'::"UserRole";

DELETE FROM "GlobalRolePermission" grp
USING "GlobalRoleDefinition" grd
WHERE grp."globalRoleDefinitionId" = grd.id
  AND grd."legacyRole" = 'CLERK_IN_CHARGE_BPO'::"UserRole";

DELETE FROM "GlobalRoleDefinition" WHERE "legacyRole" = 'CLERK_IN_CHARGE_BPO'::"UserRole";

CREATE TYPE "UserRole_new" AS ENUM (
  'ADMIN',
  'DIRECTOR',
  'MANAGER',
  'OFFICER',
  'SENIOR_SUPERVISOR',
  'SUPERVISOR',
  'CLERK'
);

ALTER TABLE "RolePermission" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");

ALTER TABLE "GlobalRoleDefinition" ALTER COLUMN "legacyRole" TYPE "UserRole_new" USING (
  CASE
    WHEN "legacyRole" IS NULL THEN NULL
    ELSE "legacyRole"::text::"UserRole_new"
  END
);

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CLERK'::"UserRole_new";

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
