-- Add customer residency and explicit taxpayer fields

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomerResidency') THEN
    CREATE TYPE "CustomerResidency" AS ENUM ('LOCAL', 'OVERSEAS');
  END IF;
END
$$;

ALTER TABLE "Customer"
ADD COLUMN IF NOT EXISTS "residency" "CustomerResidency" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN IF NOT EXISTS "hasTaxpayerId" BOOLEAN NOT NULL DEFAULT FALSE;

