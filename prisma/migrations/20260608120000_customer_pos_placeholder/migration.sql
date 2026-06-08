-- Mark POS-only system customers (walk-in, ration, public relation) so they can be
-- excluded from operational customer pickers while remaining valid FK targets for sales.

ALTER TABLE "Customer" ADD COLUMN "isPosPlaceholder" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Customer"
SET "isPosPlaceholder" = true
WHERE LOWER(TRIM("name")) IN (
  LOWER('Walk-in (POS)'),
  LOWER('Worker ration (POS)'),
  LOWER('Public relation (POS)')
);
