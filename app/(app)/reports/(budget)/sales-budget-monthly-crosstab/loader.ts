import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import {
  getOrInitProductSalesBudgetMonthPhaseProfile,
  profileRowToPercentDecimals,
} from "@/lib/sales-budget-profile";
import {
  computeMonthlyBudgetQtyKgByFiscalMonth,
  formatPhasedQtyKgDisplay,
} from "@/lib/sales-budget-phase";
import { fiscalPeriodForCalendarMonth } from "@/lib/fiscal";
import { prismaDateToIso } from "@/lib/posting-calendar";

export const CAL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const z = new Prisma.Decimal(0);

export type MonthlyCrosstabRow = {
  productId: number;
  label: string;
  cells: Prisma.Decimal[];
  rowTotal: Prisma.Decimal;
};

export type MonthlyCrosstabData = {
  settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
  yearChoices: number[];
  reportYear: number;
  hasAnyBudget: boolean;
  productsInReportCount: number;
  rows: MonthlyCrosstabRow[];
  colTotals: Prisma.Decimal[];
  grandTotal: Prisma.Decimal;
};

export async function loadMonthlyBudgetCrosstab(
  yearRaw: string | null | undefined,
): Promise<MonthlyCrosstabData> {
  const settings = await getOrInitCompanySettings();
  const prisma = getPrismaClient();

  const [periods, products, budgets] = await Promise.all([
    prismaRetry(() =>
      prisma.financialYearPeriod.findMany({
        orderBy: { financialYear: "desc" },
        select: { financialYear: true, startDate: true, endDate: true },
      }),
    ),
    prismaRetry(() =>
      prisma.product.findMany({
        orderBy: { productName: "asc" },
        select: { productId: true, productName: true, productCode: true },
      }),
    ),
    prismaRetry(() =>
      prisma.productSalesBudget.findMany({
        select: {
          financialYear: true,
          productId: true,
          annualQtyKg: true,
        },
      }),
    ),
  ]);

  const periodsByFy = new Map(periods.map((p) => [p.financialYear, p]));

  const yearsSet = new Set<number>();
  const yNow = new Date().getUTCFullYear();
  yearsSet.add(yNow);
  for (const p of periods) {
    const sy = p.startDate.getUTCFullYear();
    const ey = p.endDate.getUTCFullYear();
    for (let y = sy; y <= ey; y++) yearsSet.add(y);
  }
  const yearChoices = [...yearsSet].sort((a, b) => b - a);

  const yParsed = Number.parseInt(String(yearRaw ?? "").trim(), 10);
  const reportYear =
    Number.isFinite(yParsed) && yearChoices.includes(yParsed)
      ? yParsed
      : (yearChoices[0] ?? yNow);

  const budgetMap = new Map<string, (typeof budgets)[number]>();
  const productIdsWithBudget = new Set<number>();
  for (const b of budgets) {
    budgetMap.set(`${b.productId}:${b.financialYear}`, b);
    productIdsWithBudget.add(b.productId);
  }

  const productsInReport = products.filter((p) =>
    productIdsWithBudget.has(p.productId),
  );

  const phasePctByProductFy = new Map<string, Prisma.Decimal[]>();
  const pairSeen = new Set<string>();
  const pairList: { productId: number; financialYear: number }[] = [];
  for (const p of productsInReport) {
    for (const m of CAL_MONTHS) {
      const { financialYear } = fiscalPeriodForCalendarMonth(
        reportYear,
        m,
        settings.fiscalYearStartMonth,
      );
      if (!budgetMap.has(`${p.productId}:${financialYear}`)) continue;
      const pk = `${p.productId}:${financialYear}`;
      if (pairSeen.has(pk)) continue;
      pairSeen.add(pk);
      pairList.push({ productId: p.productId, financialYear });
    }
  }
  await Promise.all(
    pairList.map(async ({ productId, financialYear }) => {
      const row = await getOrInitProductSalesBudgetMonthPhaseProfile(
        financialYear,
        productId,
      );
      phasePctByProductFy.set(
        `${productId}:${financialYear}`,
        profileRowToPercentDecimals(row),
      );
    }),
  );

  const monthlyCache = new Map<string, Prisma.Decimal[]>();

  function monthlyLine(productId: number, fy: number): Prisma.Decimal[] | null {
    const b = budgetMap.get(`${productId}:${fy}`);
    if (!b) return null;
    const period = periodsByFy.get(fy);
    if (!period) return null;
    const pcts = phasePctByProductFy.get(`${productId}:${fy}`);
    if (!pcts) return null;
    const key = `${productId}:${fy}`;
    let line = monthlyCache.get(key);
    if (!line) {
      line = computeMonthlyBudgetQtyKgByFiscalMonth({
        financialYear: fy,
        fiscalYearStartMonth: settings.fiscalYearStartMonth,
        fyStartIso: prismaDateToIso(period.startDate),
        fyEndIso: prismaDateToIso(period.endDate),
        annualQtyKg: b.annualQtyKg,
        fiscalMonthPercents: pcts,
      });
      monthlyCache.set(key, line);
    }
    return line;
  }

  const rows: MonthlyCrosstabRow[] = productsInReport.map((p) => {
    const cells: Prisma.Decimal[] = [];
    let rowTotal = z;
    for (const m of CAL_MONTHS) {
      const { financialYear, financialMonth } = fiscalPeriodForCalendarMonth(
        reportYear,
        m,
        settings.fiscalYearStartMonth,
      );
      const line = monthlyLine(p.productId, financialYear);
      const kg = line ? line[financialMonth - 1]! : z;
      cells.push(kg);
      rowTotal = rowTotal.add(kg);
    }
    const code = p.productCode ? ` (${p.productCode})` : "";
    return {
      productId: p.productId,
      label: `${p.productName}${code}`,
      cells,
      rowTotal,
    };
  });

  const colTotals = CAL_MONTHS.map((_, i) =>
    rows.reduce((s, r) => s.add(r.cells[i]!), z),
  );
  const grandTotal = colTotals.reduce((s, c) => s.add(c), z);

  return {
    settings,
    yearChoices,
    reportYear,
    hasAnyBudget: budgets.length > 0,
    productsInReportCount: productsInReport.length,
    rows,
    colTotals,
    grandTotal,
  };
}

export const fmtMonthlyKg = formatPhasedQtyKgDisplay;
