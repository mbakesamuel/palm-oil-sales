import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { batchGetOrInitProfilesForProducts } from "@/lib/sales-budget-profile";
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
  const [periods, settings, products] = await Promise.all([
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

  let profilePctsByProduct: Record<number, string[]> = {};
  if (selectedFy != null && products.length > 0) {
    const profileMap = await batchGetOrInitProfilesForProducts(
      selectedFy,
      products.map((p) => p.productId),
    );
    profilePctsByProduct = Object.fromEntries(
      products.map((p) => {
        const row = profileMap.get(p.productId);
        if (!row) {
          return [p.productId, Array.from({ length: 12 }, () => "0")];
        }
        return [
          p.productId,
          [
            row.pctM01.toString(),
            row.pctM02.toString(),
            row.pctM03.toString(),
            row.pctM04.toString(),
            row.pctM05.toString(),
            row.pctM06.toString(),
            row.pctM07.toString(),
            row.pctM08.toString(),
            row.pctM09.toString(),
            row.pctM10.toString(),
            row.pctM11.toString(),
            row.pctM12.toString(),
          ],
        ];
      }),
    );
  }

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

  return (
    <SalesBudgetClient
      periods={periods}
      selectedFinancialYear={selectedFy}
      fiscalYearStartMonth={settings.fiscalYearStartMonth}
      fiscalMonthLabels={fiscalMonthLabels}
      profilePctsByProduct={profilePctsByProduct}
      products={products}
      budgetByProduct={budgetByProduct}
    />
  );
}
