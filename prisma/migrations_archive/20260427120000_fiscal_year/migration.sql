-- Fiscal year settings and per-transaction snapshots
ALTER TABLE "CompanySettings" ADD COLUMN "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Sale" ADD COLUMN "financialYear" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "financialMonth" INTEGER;

ALTER TABLE "DeliveryOrder" ADD COLUMN "financialYear" INTEGER;
ALTER TABLE "DeliveryOrder" ADD COLUMN "financialMonth" INTEGER;

CREATE INDEX "Sale_financialYear_financialMonth_idx" ON "Sale"("financialYear", "financialMonth");
CREATE INDEX "DeliveryOrder_financialYear_financialMonth_idx" ON "DeliveryOrder"("financialYear", "financialMonth");
