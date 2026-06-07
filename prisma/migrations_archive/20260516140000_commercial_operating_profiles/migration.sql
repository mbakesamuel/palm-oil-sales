-- Commercial operating profiles, service-scoped roles, factories.

CREATE TYPE "CommercialSiteKind" AS ENUM ('SALES_POINT', 'FACTORY');

ALTER TABLE "CommercialService" ADD COLUMN "siteKind" "CommercialSiteKind" NOT NULL DEFAULT 'SALES_POINT';
ALTER TABLE "CommercialService" ADD COLUMN "enabledModules" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "CommercialServiceRole" (
    "id" TEXT NOT NULL,
    "commercialServiceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialServiceRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialServiceRolePermission" (
    "id" TEXT NOT NULL,
    "commercialServiceRoleId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialServiceRolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Factory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commercialServiceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Factory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "commercialServiceRoleId" TEXT;
ALTER TABLE "User" ADD COLUMN "factoryId" TEXT;

CREATE UNIQUE INDEX "CommercialServiceRole_commercialServiceId_code_key" ON "CommercialServiceRole"("commercialServiceId", "code");
CREATE INDEX "CommercialServiceRole_commercialServiceId_isActive_idx" ON "CommercialServiceRole"("commercialServiceId", "isActive");

CREATE UNIQUE INDEX "CommercialServiceRolePermission_commercialServiceRoleId_key_key" ON "CommercialServiceRolePermission"("commercialServiceRoleId", "key");
CREATE INDEX "CommercialServiceRolePermission_key_idx" ON "CommercialServiceRolePermission"("key");

CREATE UNIQUE INDEX "Factory_commercialServiceId_name_key" ON "Factory"("commercialServiceId", "name");
CREATE INDEX "Factory_commercialServiceId_isActive_idx" ON "Factory"("commercialServiceId", "isActive");

CREATE INDEX "User_commercialServiceRoleId_idx" ON "User"("commercialServiceRoleId");
CREATE INDEX "User_factoryId_idx" ON "User"("factoryId");

ALTER TABLE "CommercialServiceRole" ADD CONSTRAINT "CommercialServiceRole_commercialServiceId_fkey" FOREIGN KEY ("commercialServiceId") REFERENCES "CommercialService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommercialServiceRolePermission" ADD CONSTRAINT "CommercialServiceRolePermission_commercialServiceRoleId_fkey" FOREIGN KEY ("commercialServiceRoleId") REFERENCES "CommercialServiceRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Factory" ADD CONSTRAINT "Factory_commercialServiceId_fkey" FOREIGN KEY ("commercialServiceId") REFERENCES "CommercialService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_commercialServiceRoleId_fkey" FOREIGN KEY ("commercialServiceRoleId") REFERENCES "CommercialServiceRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Palm-oil style default line: full module set (keys match lib/commercial-modules.ts).
UPDATE "CommercialService"
SET
  "siteKind" = 'SALES_POINT',
  "enabledModules" = '["dashboard","setup","customers","financial","catalog","sales_points","palm_operations","palm_stock","palm_reports","bpo"]'::jsonb
WHERE "code" = 'default';

UPDATE "CommercialService"
SET
  "siteKind" = 'SALES_POINT',
  "enabledModules" = '["dashboard","setup","customers","financial","catalog","sales_points","palm_operations","palm_stock","palm_reports","bpo"]'::jsonb
WHERE "siteKind" = 'SALES_POINT' AND ("enabledModules" = '[]'::jsonb OR "enabledModules" IS NULL);

-- Rubber line: align an existing RB-prefixed row, then create only if still missing.
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

INSERT INTO "CommercialService" ("id", "code", "name", "invoicePrefix", "phone", "address", "isActive", "sortOrder", "siteKind", "enabledModules", "createdAt", "updatedAt")
SELECT
  'cmcommercialrubbersvc1',
  'rubber',
  'Rubber Sales',
  'RB',
  NULL,
  NULL,
  true,
  10,
  'FACTORY',
  '["dashboard","setup","customers","financial","catalog","factories","rubber_operations","rubber_reports"]'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "CommercialService" WHERE "code" = 'rubber')
  AND NOT EXISTS (SELECT 1 FROM "CommercialService" WHERE "invoicePrefix" = 'RB');

UPDATE "CommercialService"
SET
  "siteKind" = 'FACTORY',
  "enabledModules" = '["dashboard","setup","customers","financial","catalog","factories","rubber_operations","rubber_reports"]'::jsonb
WHERE "code" = 'rubber';
