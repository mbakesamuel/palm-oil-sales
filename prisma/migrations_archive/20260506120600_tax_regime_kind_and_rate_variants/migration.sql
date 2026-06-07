-- Add tax regime kind (Simplified vs Real) and tax rate variants (for Sales Tax rules)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaxRegimeKind') THEN
    CREATE TYPE "TaxRegimeKind" AS ENUM ('SIMPLIFIED', 'REAL');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaxRateVariant') THEN
    CREATE TYPE "TaxRateVariant" AS ENUM ('DEFAULT', 'SIMPLIFIED', 'REAL', 'NO_TAXPAYER_ID');
  END IF;
END
$$;

ALTER TABLE "TaxRegime"
ADD COLUMN IF NOT EXISTS "kind" "TaxRegimeKind" NOT NULL DEFAULT 'SIMPLIFIED';

ALTER TABLE "TaxRateSchedule"
ADD COLUMN IF NOT EXISTS "variant" "TaxRateVariant" NOT NULL DEFAULT 'DEFAULT';

-- Prevent duplicate schedules per date+variant per tax type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'TaxRateSchedule_taxTypeId_effectiveFrom_variant_key'
  ) THEN
    CREATE UNIQUE INDEX "TaxRateSchedule_taxTypeId_effectiveFrom_variant_key"
      ON "TaxRateSchedule" ("taxTypeId", "effectiveFrom", "variant");
  END IF;
END
$$;

