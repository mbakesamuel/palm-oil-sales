-- Global role display metadata (enum values remain on User.role).

CREATE TABLE "GlobalRoleDefinition" (
    "role" "UserRole" NOT NULL,
    "displayName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalRoleDefinition_pkey" PRIMARY KEY ("role")
);

INSERT INTO "GlobalRoleDefinition" ("role", "displayName", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('ADMIN', 'Admin', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('DIRECTOR', 'Director', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('MANAGER', 'Manager', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('SENIOR_SUPERVISOR', 'Senior sales supervisor', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('SUPERVISOR', 'Sales supervisor', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CLERK', 'Sales clerk', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CLERK_IN_CHARGE_BPO', 'Clerk in charge BPO', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("role") DO NOTHING;
