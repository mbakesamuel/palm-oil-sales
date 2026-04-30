-- Financial year explicit calendar bounds
ALTER TABLE "FinancialYearPeriod" ADD COLUMN "startDate" DATE;
ALTER TABLE "FinancialYearPeriod" ADD COLUMN "endDate" DATE;

UPDATE "FinancialYearPeriod"
SET
  "startDate" = make_date("financialYear", 1, 1),
  "endDate" = make_date("financialYear", 12, 31)
WHERE "startDate" IS NULL;

ALTER TABLE "FinancialYearPeriod" ALTER COLUMN "startDate" SET NOT NULL;
ALTER TABLE "FinancialYearPeriod" ALTER COLUMN "endDate" SET NOT NULL;

-- Sale: calendar year of working month
ALTER TABLE "Sale" ADD COLUMN "postingCalendarYear" INTEGER;

UPDATE "Sale"
SET
  "postingCalendarYear" = EXTRACT(YEAR FROM COALESCE("dateIssued", "soldAt"))::int,
  "financialMonth" = EXTRACT(MONTH FROM COALESCE("dateIssued", "soldAt"))::int
WHERE "postingCalendarYear" IS NULL;

ALTER TABLE "Sale" ALTER COLUMN "postingCalendarYear" SET NOT NULL;

DROP INDEX IF EXISTS "Sale_financialYear_financialMonth_idx";

CREATE INDEX "Sale_financialYear_postingCalendarYear_financialMonth_idx"
  ON "Sale"("financialYear", "postingCalendarYear", "financialMonth");

-- Delivery order: calendar year of working month
ALTER TABLE "DeliveryOrder" ADD COLUMN "postingCalendarYear" INTEGER;

UPDATE "DeliveryOrder"
SET
  "postingCalendarYear" = EXTRACT(YEAR FROM "dateIssued")::int,
  "financialMonth" = EXTRACT(MONTH FROM "dateIssued")::int
WHERE "postingCalendarYear" IS NULL;

ALTER TABLE "DeliveryOrder" ALTER COLUMN "postingCalendarYear" SET NOT NULL;

DROP INDEX IF EXISTS "DeliveryOrder_financialYear_financialMonth_idx";

CREATE INDEX "DeliveryOrder_financialYear_postingCalendarYear_financialMonth_idx"
  ON "DeliveryOrder"("financialYear", "postingCalendarYear", "financialMonth");
