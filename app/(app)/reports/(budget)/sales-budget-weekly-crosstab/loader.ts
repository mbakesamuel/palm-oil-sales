import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import {
  getOrInitProductSalesBudgetMonthPhaseProfile,
  profileRowToPercentDecimals,
} from "@/lib/sales-budget-profile";
import {
  buildSalesBudgetPhase,
  formatPhasedQtyKgDisplay,
  type SalesBudgetPhaseResult,
} from "@/lib/sales-budget-phase";
import { fiscalPeriodForCalendarMonth } from "@/lib/fiscal";
import { prismaDateToIso } from "@/lib/posting-calendar";

export const CAL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const z = new Prisma.Decimal(0);

export function cellKey(weekLabel: string, productId: number, month: number) {
  return `${weekLabel}|||${productId}:${month}`;
}

export const fmtWeeklyKg = formatPhasedQtyKgDisplay;

export type WeekMeta = { label: string; wy: number; wk: number };

export type WeeklyCrosstabData = {
  settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
  yearChoices: number[];
  reportYear: number;
  hasAnyBudget: boolean;
  productsInReport: Array<{
    productId: number;
    productName: string;
    productCode: string | null;
  }>;
  sortedWeeks: WeekMeta[];
  cols: Array<{ productId: number; month: number }>;
  qtyByCell: Map<string, Prisma.Decimal>;
  rowTotals: Prisma.Decimal[];
  colTotals: Prisma.Decimal[];
  grandTotal: Prisma.Decimal;
};

export async function loadWeeklyBudgetCrosstab(
  yearRaw: string | null | undefined,
): Promise<WeeklyCrosstabData> {
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
          budgetUnitPricePerKg: true,
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

  const phaseResultCache = new Map<string, SalesBudgetPhaseResult | null>();

  function getPhaseResult(
    productId: number,
    fy: number,
  ): SalesBudgetPhaseResult | null {
    const cacheKey = `${productId}:${fy}`;
    if (phaseResultCache.has(cacheKey)) {
      return phaseResultCache.get(cacheKey) ?? null;
    }
    const b = budgetMap.get(`${productId}:${fy}`);
    const period = periodsByFy.get(fy);
    const pcts = phasePctByProductFy.get(`${productId}:${fy}`);
    if (!b || !period || !pcts) {
      phaseResultCache.set(cacheKey, null);
      return null;
    }
    try {
      const r = buildSalesBudgetPhase({
        financialYear: fy,
        fiscalYearStartMonth: settings.fiscalYearStartMonth,
        fyStartIso: prismaDateToIso(period.startDate),
        fyEndIso: prismaDateToIso(period.endDate),
        annualQtyKg: b.annualQtyKg,
        budgetUnitPricePerKg: b.budgetUnitPricePerKg,
        fiscalMonthPercents: pcts,
      });
      phaseResultCache.set(cacheKey, r);
      return r;
    } catch {
      phaseResultCache.set(cacheKey, null);
      return null;
    }
  }

  const weekDedup = new Map<string, WeekMeta>();
  const qtyByCell = new Map<string, Prisma.Decimal>();

  for (const p of productsInReport) {
    for (const m of CAL_MONTHS) {
      const { financialYear } = fiscalPeriodForCalendarMonth(
        reportYear,
        m,
        settings.fiscalYearStartMonth,
      );
      const phase = getPhaseResult(p.productId, financialYear);
      if (!phase) continue;
      const pm = phase.months.find(
        (x) => x.calendarYear === reportYear && x.calendarMonth === m,
      );
      if (!pm) continue;
      for (const w of pm.weeks) {
        const sortKey = `${String(w.isoWeekYear).padStart(4, "0")}-W${String(
          w.isoWeek,
        ).padStart(2, "0")}`;
        if (!weekDedup.has(sortKey)) {
          weekDedup.set(sortKey, {
            label: w.label,
            wy: w.isoWeekYear,
            wk: w.isoWeek,
          });
        }
        qtyByCell.set(
          cellKey(w.label, p.productId, m),
          new Prisma.Decimal(w.qtyKg),
        );
      }
    }
  }

  const sortedWeeks = [...weekDedup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, meta]) => meta);

  const cols: { productId: number; month: number }[] = [];
  for (const p of productsInReport) {
    for (const m of CAL_MONTHS) {
      cols.push({ productId: p.productId, month: m });
    }
  }

  const rowTotals = sortedWeeks.map((wk) => {
    let t = z;
    for (const c of cols) {
      const q = qtyByCell.get(cellKey(wk.label, c.productId, c.month)) ?? z;
      t = t.add(q);
    }
    return t;
  });

  const colTotals = cols.map((c) => {
    let t = z;
    for (const wk of sortedWeeks) {
      const q = qtyByCell.get(cellKey(wk.label, c.productId, c.month)) ?? z;
      t = t.add(q);
    }
    return t;
  });

  const grandTotal = colTotals.reduce((s, c) => s.add(c), z);

  return {
    settings,
    yearChoices,
    reportYear,
    hasAnyBudget: budgets.length > 0,
    productsInReport,
    sortedWeeks,
    cols,
    qtyByCell,
    rowTotals,
    colTotals,
    grandTotal,
  };
}
