UPDATE "CommercialService"
SET
  "siteKind" = 'FACTORY',
  "enabledModules" = '["dashboard","setup","customers","financial","catalog","factories","rubber_operations","rubber_reports"]'::jsonb
WHERE "code" = 'rubber';

UPDATE "CommercialService"
SET
  "code" = 'rubber',
  "name" = COALESCE(NULLIF(TRIM("name"), ''), 'Rubber Sales'),
  "siteKind" = 'FACTORY',
  "enabledModules" = '["dashboard","setup","customers","financial","catalog","factories","rubber_operations","rubber_reports"]'::jsonb,
  "isActive" = true,
  "sortOrder" = COALESCE("sortOrder", 10)
WHERE "invoicePrefix" = 'RB'
  AND "code" <> 'rubber';
