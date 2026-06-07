-- Customer types setup route — mirror payment methods access.

INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || csrp."commercialServiceRoleId" || 'route:/setup/customer-types'),
  csrp."commercialServiceRoleId",
  'route:/setup/customer-types',
  csrp."allowed",
  NOW(),
  NOW()
FROM "CommercialServiceRolePermission" csrp
WHERE csrp."key" = 'route:/setup/payment-methods'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

INSERT INTO "RolePermission" ("id", "role", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || rp."role"::text || 'route:/setup/customer-types'),
  rp."role",
  'route:/setup/customer-types',
  rp."allowed",
  NOW(),
  NOW()
FROM "RolePermission" rp
WHERE rp."key" = 'route:/setup/payment-methods'
ON CONFLICT ("role", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();

INSERT INTO "GlobalRolePermission" ("id", "globalRoleDefinitionId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  md5(random()::text || grp."globalRoleDefinitionId" || 'route:/setup/customer-types'),
  grp."globalRoleDefinitionId",
  'route:/setup/customer-types',
  grp."allowed",
  NOW(),
  NOW()
FROM "GlobalRolePermission" grp
WHERE grp."key" = 'route:/setup/payment-methods'
ON CONFLICT ("globalRoleDefinitionId", "key") DO UPDATE SET
  "allowed" = EXCLUDED."allowed",
  "updatedAt" = NOW();
