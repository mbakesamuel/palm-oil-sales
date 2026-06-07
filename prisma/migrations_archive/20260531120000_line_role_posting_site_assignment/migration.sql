-- Line roles declare whether users must be tied to one sales point / factory.
ALTER TABLE "CommercialServiceRole"
ADD COLUMN "requiresFixedPostingSite" BOOLEAN NOT NULL DEFAULT true;

-- Senior supervisors and line managers roam across sales points; clerks/supervisors stay fixed.
UPDATE "CommercialServiceRole"
SET "requiresFixedPostingSite" = false,
    "updatedAt" = NOW()
WHERE (
  (LOWER("code") LIKE '%senior%' AND LOWER("code") LIKE '%supervisor%')
  OR (LOWER("code") LIKE '%manager%' AND LOWER("code") NOT LIKE '%factory%')
);
