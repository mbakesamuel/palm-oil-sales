-- Add OFFICER to UserRole enum (metadata row seeded by ensureGlobalRoleDefinitions).

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'OFFICER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
