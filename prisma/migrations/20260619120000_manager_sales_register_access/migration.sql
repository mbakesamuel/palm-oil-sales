-- Managers (and similar line roles) were blocked from /reports/sales when either:
-- 1) palm_reports was omitted from CommercialService.enabledModules while palm_operations was on, or
-- 2) CommercialServiceRolePermission had route:/reports/sales = false for manager templates.

UPDATE "CommercialService"
SET "enabledModules" = "enabledModules" || '["palm_reports"]'::jsonb
WHERE "siteKind" = 'SALES_POINT'
  AND ("enabledModules" @> '["palm_operations"]'::jsonb)
  AND NOT ("enabledModules" @> '["palm_reports"]'::jsonb);

UPDATE "CommercialService"
SET "enabledModules" = "enabledModules" || '["rubber_reports"]'::jsonb
WHERE "siteKind" = 'FACTORY'
  AND ("enabledModules" @> '["rubber_operations"]'::jsonb)
  AND NOT ("enabledModules" @> '["rubber_reports"]'::jsonb);

UPDATE "CommercialServiceRolePermission" csrp
SET "allowed" = true, "updatedAt" = NOW()
FROM "CommercialServiceRole" csr
WHERE csrp."commercialServiceRoleId" = csr.id
  AND LOWER(csr."code") LIKE '%manager%'
  AND csrp."key" IN ('route:/reports', 'route:/reports/sales')
  AND csrp."allowed" = false;
