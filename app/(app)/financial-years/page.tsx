import { getServerSession } from "@/lib/auth-server";
import { UserRole } from "@/lib/domain";
import { getPrismaClient } from "@/lib/prisma";
import { resolveBotaSalesPointId } from "@/lib/pos/sale-product-mode";
import {
  canSetSalesPointWorkingMonth,
} from "@/lib/sales-point-working-month";
import { closeFinancialYearPeriod, openFinancialYearPeriod } from "./actions";
import { FinancialYearsClient } from "./FinancialYearsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function FinancialYearsPage() {
  const prisma = getPrismaClient();
  const session = await getServerSession();

  const [periods, salesPoints, botaSalesPointId] = await Promise.all([
    prisma.financialYearPeriod.findMany({
      orderBy: { financialYear: "desc" },
    }),
    prisma.salesPoint.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    resolveBotaSalesPointId(prisma),
  ]);

  const canAdminSiteMonth =
    session?.role === UserRole.ADMIN || session?.role === UserRole.DIRECTOR;
  const canSetBotaSiteMonth =
    session != null &&
    botaSalesPointId != null &&
    (await canSetSalesPointWorkingMonth(session, botaSalesPointId));

  return (
    <FinancialYearsClient
      periods={periods}
      salesPoints={salesPoints}
      botaSalesPointId={botaSalesPointId}
      canAdminSiteMonth={canAdminSiteMonth}
      canSetBotaSiteMonth={canSetBotaSiteMonth}
      openFinancialYearPeriodAction={openFinancialYearPeriod}
      closeFinancialYearPeriodAction={closeFinancialYearPeriod}
    />
  );
}
