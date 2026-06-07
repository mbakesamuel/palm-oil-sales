-- Ensure admin/director users are linked to GlobalRoleDefinition (production backfill).

UPDATE "User" u
SET "globalRoleDefinitionId" = grd.id
FROM "GlobalRoleDefinition" grd
WHERE u."globalRoleDefinitionId" IS NULL
  AND u."commercialServiceRoleId" IS NULL
  AND u.role IN ('ADMIN', 'DIRECTOR')
  AND grd."legacyRole" = u.role
  AND grd."isActive" = true;

-- Admin role: grant all permission keys (idempotent).
INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  grd.id,
  k.key,
  true,
  NOW(),
  NOW()
FROM "GlobalRoleDefinition" grd
CROSS JOIN unnest(ARRAY[
  'route:/dashboard',
  'route:/dashboard/executive',
  'route:/setup',
  'route:/setup/commercial-services',
  'route:/setup/permissions',
  'route:/setup/role-access',
  'route:/setup/product-pricing',
  'route:/setup/product-variants',
  'route:/setup/sales-budget',
  'route:/users',
  'route:/customers',
  'route:/financial-years',
  'route:/sales-points',
  'route:/factories',
  'route:/rubber',
  'route:/tax-regimes',
  'route:/tax-types',
  'route:/product-categories',
  'route:/products',
  'route:/delivery-orders',
  'route:/delivery-orders/list',
  'route:/delivery-orders/validation-queue',
  'route:/consignment-notes',
  'route:/pos',
  'route:/pos/list',
  'route:/reports',
  'route:/reports/sales',
  'route:/reports/daily-sales-summary',
  'route:/reports/daily-sales-summary/print',
  'route:/reports/sales-summary-by-customer',
  'route:/reports/sales-summary-by-customer/print',
  'route:/reports/delivery-orders',
  'route:/reports/delivery-order-monitor',
  'route:/reports/customer-delivery-monitor',
  'route:/reports/do-commitment-crosstab',
  'route:/reports/do-commitment-crosstab/print',
  'route:/reports/stock-on-hand',
  'route:/reports/stock-on-hand/print',
  'route:/reports/stock-inquiry',
  'route:/reports/stock-inquiry/print',
  'route:/reports/stock-vs-commitments',
  'route:/reports/stock-vs-commitments/print',
  'route:/api/mobile/v1',
  'route:/reports/sales-budget-monthly-crosstab',
  'route:/reports/sales-budget-weekly-crosstab',
  'route:/reports/pricing',
  'route:/stock',
  'ui:validate-documents',
  'ui:validate-delivery-orders',
  'ui:manage-access-control',
  'ui:post-stock-receipt',
  'ui:dispatch-stock-transfer',
  'ui:receive-stock-transfer',
  'ui:post-stock-adjustment',
  'ui:reclassify-stock-condition',
  'ui:cancel-stock-document'
]::text[]) AS k(key)
WHERE grd."legacyRole" = 'ADMIN'
  AND grd."isActive" = true
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();
