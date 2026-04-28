import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { closeFinancialYearPeriod, openFinancialYearPeriod } from "./actions";
import { FinancialYearsClient } from "./FinancialYearsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FinancialYearsPage() {
  const prisma = getPrismaClient();
  const [settings, periods] = await Promise.all([
    getOrInitCompanySettings(),
    prisma.financialYearPeriod.findMany({
      orderBy: { financialYear: "desc" },
    }),
  ]);

  return (
    <FinancialYearsClient
      periods={periods}
      fiscalYearStartMonth={settings.fiscalYearStartMonth}
      openFinancialYearPeriodAction={openFinancialYearPeriod}
      closeFinancialYearPeriodAction={closeFinancialYearPeriod}
    />
  );
}
