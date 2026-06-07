-- Extend UserRole enum (ignore if values already exist)
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'DIRECTOR';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'SENIOR_SUPERVISOR';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable User: login + dummy password + optional sales point
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordPlain" TEXT;
ALTER TABLE "User" ADD COLUMN "salesPointId" INTEGER;

UPDATE "User" SET "passwordPlain" = 'changeme' WHERE "passwordPlain" IS NULL;

UPDATE "User" SET "username" = 'user_' || REPLACE("id"::text, '-', '') WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "passwordPlain" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "User" ADD CONSTRAINT "User_salesPointId_fkey" FOREIGN KEY ("salesPointId") REFERENCES "SalesPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
