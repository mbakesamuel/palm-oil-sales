-- Sales-point line roles (clerks, supervisors, etc.) were seeded with only
-- route:/reports and route:/reports/sales. Sub-routes such as daily-sales-summary
-- stayed false in CommercialServiceRolePermission and blocked /forbidden.

UPDATE "CommercialServiceRolePermission" csrp
SET "allowed" = true, "updatedAt" = NOW()
FROM "CommercialServiceRole" csr
JOIN "CommercialService" cs ON cs.id = csr."commercialServiceId"
WHERE csrp."commercialServiceRoleId" = csr.id
  AND cs."siteKind" = 'SALES_POINT'
  AND LOWER(csr."code") NOT LIKE 'factory%'
  AND csrp."key" IN (
    'route:/reports/daily-sales-summary',
    'route:/reports/delivery-orders',
    'route:/reports/delivery-order-monitor',
    'route:/reports/customer-delivery-monitor',
    'route:/reports/do-commitment-crosstab',
    'route:/reports/sales-budget-monthly-crosstab',
    'route:/reports/sales-budget-weekly-crosstab',
    'route:/reports/pricing'
  );

INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csr.id || k.key),
  csr.id,
  k.key,
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
JOIN "CommercialService" cs ON cs.id = csr."commercialServiceId"
CROSS JOIN (
  VALUES
    ('route:/reports/daily-sales-summary'),
    ('route:/reports/delivery-orders'),
    ('route:/reports/delivery-order-monitor'),
    ('route:/reports/customer-delivery-monitor'),
    ('route:/reports/do-commitment-crosstab'),
    ('route:/reports/sales-budget-monthly-crosstab'),
    ('route:/reports/sales-budget-weekly-crosstab'),
    ('route:/reports/pricing')
) AS k(key)
WHERE cs."siteKind" = 'SALES_POINT'
  AND LOWER(csr."code") NOT LIKE 'factory%'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET "allowed" = true, "updatedAt" = NOW();
