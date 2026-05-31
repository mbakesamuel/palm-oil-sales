-- Remove BPO outbound sales (employee credit, dedicated routes). Bottled SKUs use POS.

DROP TABLE IF EXISTS "BpoEmployeeCreditSale";

DROP TYPE IF EXISTS "BpoEmployeeCollectedProduct";

-- Retire line role used only for BPO.
DELETE FROM "CommercialServiceRolePermission" csrp
USING "CommercialServiceRole" csr
WHERE csrp."commercialServiceRoleId" = csr.id
  AND csr.code = 'bpo_clerk';

DELETE FROM "CommercialServiceRole" WHERE code = 'bpo_clerk';

-- Remove BPO module from enabledModules JSON on commercial services.
UPDATE "CommercialService"
SET
  "enabledModules" = (
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
    FROM jsonb_array_elements_text("enabledModules"::jsonb) AS elem
    WHERE elem <> 'bpo'
  )::json,
  "updatedAt" = NOW()
WHERE "enabledModules"::jsonb ? 'bpo';

-- Drop stored permissions for removed routes (all roles).
DELETE FROM "RolePermission"
WHERE "key" IN (
  'route:/bpo-sales',
  'route:/reports/bpo',
  'route:/reports/bpo-pricing',
  'route:/reports/bpo-sales-crosstab',
  'route:/setup/bpo-variants'
);

DELETE FROM "CommercialServiceRolePermission"
WHERE "key" IN (
  'route:/bpo-sales',
  'route:/reports/bpo',
  'route:/reports/bpo-pricing',
  'route:/reports/bpo-sales-crosstab',
  'route:/setup/bpo-variants'
);

DELETE FROM "GlobalRolePermission"
WHERE "key" IN (
  'route:/bpo-sales',
  'route:/reports/bpo',
  'route:/reports/bpo-pricing',
  'route:/reports/bpo-sales-crosstab',
  'route:/setup/bpo-variants'
);
