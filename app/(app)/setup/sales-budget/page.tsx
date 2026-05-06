import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getOrInitSalesBudgetMonthPhaseProfile } from "@/lib/sales-budget-profile";
import { formatFiscalMonthCalendarLabel } from "@/lib/fiscal";
import { SalesBudgetClient } from "./SalesBudgetClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SalesBudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const sp = await searchParams;
  const prisma = getPrismaClient();
  const [periods, settings, profile, products] = await Promise.all([
    prisma.financialYearPeriod.findMany({
      orderBy: { financialYear: "desc" },
      select: {
        financialYear: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    }),
    getOrInitCompanySettings(),
    getOrInitSalesBudgetMonthPhaseProfile(),
    prisma.product.findMany({
      orderBy: { productName: "asc" },
      select: {
        productId: true,
        productName: true,
        productCode: true,
      },
    }),
  ]);

  const fyParsed = Number.parseInt(String(sp.fy ?? ""), 10);
  const selectedFy =
    Number.isFinite(fyParsed) && periods.some((p) => p.financialYear === fyParsed)
      ? fyParsed
      : (periods[0]?.financialYear ?? null);

  const budgets =
    selectedFy != null
      ? await prisma.productSalesBudget.findMany({
          where: { financialYear: selectedFy },
          select: {
            productId: true,
            annualQtyKg: true,
            budgetUnitPricePerKg: true,
          },
        })
      : [];

  const budgetByProduct = Object.fromEntries(
    budgets.map((b) => [
      b.productId,
      {
        annualQtyKg: b.annualQtyKg.toString(),
        budgetUnitPricePerKg: b.budgetUnitPricePerKg.toString(),
      },
    ]),
  ) as Record<number, { annualQtyKg: string; budgetUnitPricePerKg: string }>;

  const fiscalMonthLabels = Array.from({ length: 12 }, (_, i) => {
    const fm = i + 1;
    if (selectedFy == null) {
      return { financialMonth: fm, label: `FY month ${fm}` };
    }
    return {
      financialMonth: fm,
      label: formatFiscalMonthCalendarLabel(
        selectedFy,
        fm,
        settings.fiscalYearStartMonth,
      ),
    };
  });

  const profilePcts = [
    profile.pctM01,
    profile.pctM02,
    profile.pctM03,
    profile.pctM04,
    profile.pctM05,
    profile.pctM06,
    profile.pctM07,
    profile.pctM08,
    profile.pctM09,
    profile.pctM10,
    profile.pctM11,
    profile.pctM12,
  ].map((d) => d.toString());

  return (
    <SalesBudgetClient
      periods={periods}
      selectedFinancialYear={selectedFy}
      fiscalYearStartMonth={settings.fiscalYearStartMonth}
      fiscalMonthLabels={fiscalMonthLabels}
      profilePcts={profilePcts}
      products={products}
      budgetByProduct={budgetByProduct}
    />
  );
}
