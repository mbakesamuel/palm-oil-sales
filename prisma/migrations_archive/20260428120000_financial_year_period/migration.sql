-- CreateEnum
CREATE TYPE "FinancialYearStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "FinancialYearPeriod" (
    "id" TEXT NOT NULL,
    "financialYear" INTEGER NOT NULL,
    "status" "FinancialYearStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "FinancialYearPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialYearPeriod_financialYear_key" ON "FinancialYearPeriod"("financialYear");

-- CreateIndex
CREATE INDEX "FinancialYearPeriod_status_idx" ON "FinancialYearPeriod"("status");
