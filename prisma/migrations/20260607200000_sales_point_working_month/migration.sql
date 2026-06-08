-- Per sales point working calendar month (supervisor-controlled for fixed-site staff).

ALTER TABLE "SalesPoint" ADD COLUMN "workingCalendarYear" INTEGER;
ALTER TABLE "SalesPoint" ADD COLUMN "workingCalendarMonth" INTEGER;
ALTER TABLE "SalesPoint" ADD COLUMN "workingFinancialYear" INTEGER;
ALTER TABLE "SalesPoint" ADD COLUMN "workingMonthSetAt" TIMESTAMP(3);
ALTER TABLE "SalesPoint" ADD COLUMN "workingMonthSetById" TEXT;

ALTER TABLE "SalesPoint" ADD CONSTRAINT "SalesPoint_workingMonthSetById_fkey" FOREIGN KEY ("workingMonthSetById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
