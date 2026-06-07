-- Senior supervisors draft delivery orders; ensure line role permissions include DO routes.

INSERT INTO "CommercialServiceRolePermission" ("id", "commercialServiceRoleId", "key", "allowed", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  csr.id,
  k.key,
  true,
  NOW(),
  NOW()
FROM "CommercialServiceRole" csr
CROSS JOIN (
  VALUES
    ('route:/delivery-orders'),
    ('route:/delivery-orders/list'),
    ('route:/customers'),
    ('route:/products'),
    ('route:/product-categories'),
    ('route:/pos'),
    ('route:/pos/list')
) AS k(key)
WHERE csr."isActive" = true
  AND LOWER(csr."code") LIKE '%senior%'
  AND LOWER(csr."code") LIKE '%supervisor%'
ON CONFLICT ("commercialServiceRoleId", "key") DO UPDATE SET
  "allowed" = true,
  "updatedAt" = NOW();
