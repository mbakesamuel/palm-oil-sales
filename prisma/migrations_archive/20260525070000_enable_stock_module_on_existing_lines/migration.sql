-- Normalize CommercialService.enabledModules so the new `stock` module is enabled on
-- every existing commercial line. Also drops the obsolete `palm_stock` token which is
-- no longer part of COMMERCIAL_MODULE_KEYS in lib/commercial-modules.ts and was being
-- silently filtered out by parseEnabledModulesJson, leaving the line with no
-- stock-related module at all.

-- 1) Remove the legacy `palm_stock` entry from any line that still has it.
UPDATE "CommercialService"
SET "enabledModules" = "enabledModules" - 'palm_stock'
WHERE "enabledModules" @> '["palm_stock"]'::jsonb;

-- 2) Append `stock` to every line that does not already have it.
UPDATE "CommercialService"
SET "enabledModules" = "enabledModules" || '["stock"]'::jsonb
WHERE NOT ("enabledModules" @> '["stock"]'::jsonb);
