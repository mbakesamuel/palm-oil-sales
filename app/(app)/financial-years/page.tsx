import { getPrismaClient } from "@/lib/prisma";
import { closeFinancialYearPeriod, openFinancialYearPeriod } from "./actions";
import { FinancialYearsClient } from "./FinancialYearsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FinancialYearsPage() {
  const prisma = getPrismaClient();
  const periods = await prisma.financialYearPeriod.findMany({
    orderBy: { financialYear: "desc" },
  });

  return (
    <FinancialYearsClient
      periods={periods}
      openFinancialYearPeriodAction={openFinancialYearPeriod}
      closeFinancialYearPeriodAction={closeFinancialYearPeriod}
    />
  );
}
