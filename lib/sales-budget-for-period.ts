import { Prisma } from "@prisma/client";
import {
  buildSalesBudgetPhase,
  type SalesBudgetPhaseResult,
} from "@/lib/sales-budget-phase";
import {
  batchGetOrInitProfilesForProducts,
  profileRowToPercentDecimals,
} from "@/lib/sales-budget-profile";
import type { IsoDate } from "@/lib/posting-calendar";

const Dec = Prisma.Decimal;

/** Sum phased daily budget qty (kg) and revenue (XAF) for inclusive ISO date range. */
export function sumPhasedBudgetForIsoRange(
  phase: SalesBudgetPhaseResult,
  dateFrom: IsoDate,
  dateTo: IsoDate,
): { qtyKg: InstanceType<typeof Prisma.Decimal>; revenue: InstanceType<typeof Prisma.Decimal> } {
  let qtyKg = new Dec(0);
  let revenue = new Dec(0);

  for (const month of phase.months) {
    for (const day of month.days) {
      if (day.isoDate >= dateFrom && day.isoDate <= dateTo) {
        qtyKg = qtyKg.add(day.qtyKg);
        revenue = revenue.add(day.revenue);
      }
    }
  }

  return { qtyKg, revenue };
}

export type ProductPeriodBudget = {
  qtyKg: InstanceType<typeof Prisma.Decimal>;
  revenue: InstanceType<typeof Prisma.Decimal>;
};

export async function loadPhasedBudgetByProductForRange(args: {
  financialYear: number;
  fiscalYearStartMonth: number;
  fyStartIso: IsoDate;
  fyEndIso: IsoDate;
  dateFromIso: IsoDate;
  dateToIso: IsoDate;
  productIds: number[];
  budgets: Array<{
    productId: number;
    annualQtyKg: Prisma.Decimal;
    budgetUnitPricePerKg: Prisma.Decimal;
  }>;
}): Promise<Map<number, ProductPeriodBudget>> {
  const {
    financialYear,
    fiscalYearStartMonth,
    fyStartIso,
    fyEndIso,
    dateFromIso,
    dateToIso,
    productIds,
    budgets,
  } = args;

  const out = new Map<number, ProductPeriodBudget>();
  if (productIds.length === 0 || budgets.length === 0) return out;

  const budgetByProduct = new Map(budgets.map((b) => [b.productId, b]));
  const idsWithBudget = productIds.filter((id) => budgetByProduct.has(id));
  if (idsWithBudget.length === 0) return out;

  const profiles = await batchGetOrInitProfilesForProducts(financialYear, idsWithBudget);

  for (const productId of idsWithBudget) {
    const budget = budgetByProduct.get(productId)!;
    const profile = profiles.get(productId);
    if (!profile) continue;

    const phase = buildSalesBudgetPhase({
      financialYear,
      fiscalYearStartMonth,
      fyStartIso,
      fyEndIso,
      annualQtyKg: budget.annualQtyKg,
      budgetUnitPricePerKg: budget.budgetUnitPricePerKg,
      fiscalMonthPercents: profileRowToPercentDecimals(profile),
    });

    const summed = sumPhasedBudgetForIsoRange(phase, dateFromIso, dateToIso);
    out.set(productId, summed);
  }

  return out;
}

/** Actual ÷ budget × 100, or null when budget is zero. */
export function budgetAchievementPct(
  actual: InstanceType<typeof Prisma.Decimal>,
  budget: InstanceType<typeof Prisma.Decimal>,
): number | null {
  if (!budget || budget.lte(0)) return null;
  return Number(
    actual.div(budget).mul(100).toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP),
  );
}
