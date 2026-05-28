-- Some sales-point lines were missing `palm_reports` in enabledModules (e.g. after module
-- refactors), which blocked all palm report sub-routes even when role permissions allowed them.

UPDATE "CommercialService"
SET "enabledModules" = "enabledModules" || '["palm_reports"]'::jsonb
WHERE "siteKind" = 'SALES_POINT'
  AND NOT ("enabledModules" @> '["palm_reports"]'::jsonb);
