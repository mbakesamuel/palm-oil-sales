-- Commercial lines of business + per-service/year invoice counters; issuer snapshots on Sale / DeliveryOrder.

CREATE TABLE "CommercialService" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "invoicePrefix" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommercialService_code_key" ON "CommercialService"("code");

CREATE UNIQUE INDEX "CommercialService_invoicePrefix_key" ON "CommercialService"("invoicePrefix");

INSERT INTO "CommercialService" ("id", "code", "name", "invoicePrefix", "phone", "address", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT
  'cmcommercialdefaultsvc1',
  'default',
  LEFT(BTRIM(cs."companyName"), 180),
  LEFT(COALESCE(NULLIF(BTRIM(cs."invoicePrefix"), ''), 'PO'), 32),
  NULLIF(BTRIM(cs."phone"), ''),
  NULLIF(BTRIM(cs."address"), ''),
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CompanySettings" cs
WHERE cs.id = 'default';

INSERT INTO "CommercialService" ("id", "code", "name", "invoicePrefix", "phone", "address", "isActive", "sortOrder", "createdAt", "updatedAt")
SELECT 'cmcommercialdefaultsvc1', 'default', 'Commercial', 'PO', NULL, NULL, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "CommercialService" LIMIT 1);

ALTER TABLE "User" ADD COLUMN "commercialServiceId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_commercialServiceId_fkey" FOREIGN KEY ("commercialServiceId") REFERENCES "CommercialService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_commercialServiceId_idx" ON "User"("commercialServiceId");

ALTER TABLE "Sale" ADD COLUMN "commercialServiceId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "issuerPhoneSnapshot" TEXT;
ALTER TABLE "Sale" ADD COLUMN "issuerAddressSnapshot" TEXT;
ALTER TABLE "Sale" ADD COLUMN "commercialServiceNameSnapshot" TEXT;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_commercialServiceId_fkey" FOREIGN KEY ("commercialServiceId") REFERENCES "CommercialService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Sale_commercialServiceId_idx" ON "Sale"("commercialServiceId");

UPDATE "Sale" SET "commercialServiceId" = 'cmcommercialdefaultsvc1';

UPDATE "Sale" s
SET
  "issuerPhoneSnapshot" = cs."phone",
  "issuerAddressSnapshot" = cs."address",
  "commercialServiceNameSnapshot" = cs."name"
FROM "CommercialService" cs
WHERE s."commercialServiceId" = cs.id;

ALTER TABLE "DeliveryOrder" ADD COLUMN "commercialServiceId" TEXT;
ALTER TABLE "DeliveryOrder" ADD COLUMN "issuerPhoneSnapshot" TEXT;
ALTER TABLE "DeliveryOrder" ADD COLUMN "issuerAddressSnapshot" TEXT;
ALTER TABLE "DeliveryOrder" ADD COLUMN "commercialServiceNameSnapshot" TEXT;

ALTER TABLE "DeliveryOrder" ADD CONSTRAINT "DeliveryOrder_commercialServiceId_fkey" FOREIGN KEY ("commercialServiceId") REFERENCES "CommercialService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DeliveryOrder_commercialServiceId_idx" ON "DeliveryOrder"("commercialServiceId");

UPDATE "DeliveryOrder"
SET
  "commercialServiceId" = 'cmcommercialdefaultsvc1',
  "issuerPhoneSnapshot" = (SELECT NULLIF(BTRIM("phone"), '') FROM "CompanySettings" WHERE id = 'default' LIMIT 1),
  "issuerAddressSnapshot" = (SELECT NULLIF(BTRIM("address"), '') FROM "CompanySettings" WHERE id = 'default' LIMIT 1),
  "commercialServiceNameSnapshot" = (SELECT srv."name" FROM "CommercialService" srv WHERE srv."id" = 'cmcommercialdefaultsvc1');

CREATE TABLE "CommercialInvoiceSequence" (
    "commercialServiceId" TEXT NOT NULL,
    "calendarYear" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialInvoiceSequence_pkey" PRIMARY KEY ("commercialServiceId","calendarYear")
);

ALTER TABLE "CommercialInvoiceSequence" ADD CONSTRAINT "CommercialInvoiceSequence_commercialServiceId_fkey" FOREIGN KEY ("commercialServiceId") REFERENCES "CommercialService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CommercialInvoiceSequence" ("commercialServiceId", "calendarYear", "nextNumber", "updatedAt")
SELECT
  s."commercialServiceId",
  CAST(EXTRACT(YEAR FROM s."soldAt") AS INTEGER) AS yr,
  COALESCE(
    MAX(
      CAST((regexp_match(s."invoiceNo", '([0-9]{6})$'))[1] AS INTEGER)
    ),
    0
  ) + 1,
  CURRENT_TIMESTAMP
FROM "Sale" s
WHERE s."commercialServiceId" IS NOT NULL
  AND regexp_match(s."invoiceNo", '([0-9]{6})$') IS NOT NULL
GROUP BY s."commercialServiceId", CAST(EXTRACT(YEAR FROM s."soldAt") AS INTEGER);

INSERT INTO "CommercialInvoiceSequence" ("commercialServiceId", "calendarYear", "nextNumber", "updatedAt")
SELECT 'cmcommercialdefaultsvc1', CAST(EXTRACT(YEAR FROM CURRENT_DATE) AS INTEGER), inv."nextNumber", CURRENT_TIMESTAMP
FROM "InvoiceSequence" inv
WHERE inv.id = 'default'
ON CONFLICT ("commercialServiceId", "calendarYear") DO UPDATE
SET "nextNumber" = GREATEST(
  "CommercialInvoiceSequence"."nextNumber",
  EXCLUDED."nextNumber"
),
"updatedAt" = CURRENT_TIMESTAMP;

DROP TABLE "InvoiceSequence";

ALTER TABLE "CompanySettings" DROP COLUMN "phone";
ALTER TABLE "CompanySettings" DROP COLUMN "address";
ALTER TABLE "CompanySettings" DROP COLUMN "invoicePrefix";
