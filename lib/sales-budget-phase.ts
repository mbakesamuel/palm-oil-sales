import { Prisma } from "@prisma/client";
import { calendarMonthForFiscalMonth } from "@/lib/fiscal";
import { isCalendarMonthFullyInsideFy, type IsoDate } from "@/lib/posting-calendar";

const Dec = Prisma.Decimal;
type Decimal = InstanceType<typeof Prisma.Decimal>;
const ROUND_FLOOR = Dec.ROUND_FLOOR;
const ROUND_HALF_UP = Dec.ROUND_HALF_UP;

export type PhasedDay = {
  isoDate: IsoDate;
  qtyKg: string;
  revenue: string;
  isoWeekYear: number;
  isoWeek: number;
};

export type PhasedWeek = {
  isoWeekYear: number;
  isoWeek: number;
  label: string;
  qtyKg: string;
  revenue: string;
};

export type PhasedMonth = {
  financialMonth: number;
  calendarYear: number;
  calendarMonth: number;
  calendarLabel: string;
  monthlyQtyKg: string;
  monthlyRevenue: string;
  days: PhasedDay[];
  weeks: PhasedWeek[];
};

export type SalesBudgetPhaseResult = {
  annualQtyKg: string;
  budgetUnitPricePerKg: string;
  annualRevenue: string;
  months: PhasedMonth[];
};

/** Whole kg for displaying phased quantities (month / week / day rollups). */
export function formatPhasedQtyKgDisplay(qtyKg: string | Decimal): string {
  const d = typeof qtyKg === "string" ? new Dec(qtyKg) : qtyKg;
  if (!d.isFinite()) return typeof qtyKg === "string" ? qtyKg : qtyKg.toString();
  const n = Number(d.toDecimalPlaces(0, ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

/** Whole XAF for displaying phased revenue (annual / month / week / day). */
export function formatPhasedRevenueDisplay(revenue: string | Decimal): string {
  const d = typeof revenue === "string" ? new Dec(revenue) : revenue;
  if (!d.isFinite()) return typeof revenue === "string" ? revenue : revenue.toString();
  const n = Number(d.toDecimalPlaces(0, ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

/** ISO 8601 week-year and week number (UTC calendar date; Monday week start). */
export function utcIsoWeekYearAndWeek(isoDate: IsoDate): { weekYear: number; week: number } {
  const [ys, ms, ds] = isoDate.split("-").map((x) => Number.parseInt(x, 10));
  const y = ys!;
  const m = ms!;
  const d = ds!;
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNr = (date.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 3 - dayNr);
  const weekYear = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4Day = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(4 - jan4Day);
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - dayNr);
  const week = 1 + Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86400000));
  return { weekYear, week };
}

function daysInCalendarMonthUtc(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function enumerateDaysInMonth(year: number, month1to12: number): IsoDate[] {
  const n = daysInCalendarMonthUtc(year, month1to12);
  const out: IsoDate[] = [];
  for (let day = 1; day <= n; day++) {
    out.push(
      `${year}-${String(month1to12).padStart(2, "0")}-${String(day).padStart(2, "0")}` as IsoDate,
    );
  }
  return out;
}

/** Largest remainder: integer units summing to `totalUnits` from fractional ideals. */
function allocateIntegerUnits(totalUnits: number, exactParts: Prisma.Decimal[]): number[] {
  if (exactParts.length === 0) return [];
  const floors = exactParts.map((e) => e.toDecimalPlaces(0, ROUND_FLOOR).toNumber());
  const fracs = exactParts.map((e, i) => e.sub(floors[i]!).toNumber());
  const sumF = floors.reduce((a, b) => a + b, 0);
  let diff = totalUnits - sumF;
  const order = [...fracs.keys()].sort((a, b) => fracs[b]! - fracs[a]!);
  const out = [...floors];
  let k = 0;
  while (diff > 0 && order.length > 0) {
    out[order[k % order.length]!]! += 1;
    diff -= 1;
    k += 1;
  }
  k = 0;
  while (diff < 0 && order.length > 0) {
    const idx = order[order.length - 1 - (k % order.length)]!;
    out[idx]! -= 1;
    diff += 1;
    k += 1;
  }
  return out;
}

function splitQtyAcrossMonths(
  annualQtyKg: Decimal,
  normPcts: Decimal[],
): Decimal[] {
  const totalMilli = annualQtyKg.mul(1000).toDecimalPlaces(0, ROUND_HALF_UP).toNumber();
  const exacts = normPcts.map((p) => annualQtyKg.mul(p).div(100).mul(1000));
  const units = allocateIntegerUnits(totalMilli, exacts);
  return units.map((u) => new Dec(u).div(1000));
}

function splitQtyAcrossDays(monthlyQtyKg: Decimal, year: number, month1to12: number): Decimal[] {
  const n = daysInCalendarMonthUtc(year, month1to12);
  if (n === 0) return [];
  const totalMilli = monthlyQtyKg.mul(1000).toDecimalPlaces(0, ROUND_HALF_UP).toNumber();
  const exacts = Array.from({ length: n }, () => monthlyQtyKg.mul(1000).div(n));
  const units = allocateIntegerUnits(totalMilli, exacts);
  return units.map((u) => new Dec(u).div(1000));
}

function splitRevenueAcrossMonths(
  monthlyQtys: Decimal[],
  pricePerKg: Decimal,
  targetAnnualRevenueCents: number,
): Decimal[] {
  const exactCents = monthlyQtys.map((q) => q.mul(pricePerKg).mul(100));
  return allocateIntegerUnits(targetAnnualRevenueCents, exactCents).map((c) => new Dec(c).div(100));
}

function splitRevenueAcrossDays(
  dailyQtys: Decimal[],
  pricePerKg: Decimal,
  targetMonthRevenue: Decimal,
): Decimal[] {
  const targetCents = targetMonthRevenue.mul(100).toDecimalPlaces(0, ROUND_HALF_UP).toNumber();
  const exactCents = dailyQtys.map((q) => q.mul(pricePerKg).mul(100));
  return allocateIntegerUnits(targetCents, exactCents).map((c) => new Dec(c).div(100));
}

/**
 * Build phased monthly/daily qty and revenue for one product budget line.
 * Percentages are fiscal months 1–12; months without a full calendar month inside FY get 0 share
 * and remaining percentages are renormalized over included months.
 */
export function buildSalesBudgetPhase(args: {
  financialYear: number;
  fiscalYearStartMonth: number;
  fyStartIso: IsoDate;
  fyEndIso: IsoDate;
  annualQtyKg: Decimal;
  budgetUnitPricePerKg: Decimal;
  /** Length 12 — index 0 = fiscal month 1 */
  fiscalMonthPercents: Decimal[];
}): SalesBudgetPhaseResult {
  const {
    financialYear,
    fiscalYearStartMonth,
    fyStartIso,
    fyEndIso,
    annualQtyKg,
    budgetUnitPricePerKg,
    fiscalMonthPercents,
  } = args;

  if (fiscalMonthPercents.length !== 12) {
    throw new Error("Expected 12 fiscal month percentages.");
  }

  const includedFiscalMonths: number[] = [];
  for (let fm = 1; fm <= 12; fm++) {
    const { year, month } = calendarMonthForFiscalMonth(
      financialYear,
      fm,
      fiscalYearStartMonth,
    );
    if (isCalendarMonthFullyInsideFy(year, month, fyStartIso, fyEndIso)) {
      includedFiscalMonths.push(fm);
    }
  }

  const sumIncludedPct = includedFiscalMonths.reduce(
    (s, fm) => s.add(fiscalMonthPercents[fm - 1]!),
    new Dec(0),
  );
  if (sumIncludedPct.lte(0)) {
    throw new Error(
      "No fiscal months fall fully inside this financial year, or phase percentages sum to 0 for those months.",
    );
  }

  const normPcts = fiscalMonthPercents.map((p, i) => {
    const fm = i + 1;
    if (!includedFiscalMonths.includes(fm)) return new Dec(0);
    return p.div(sumIncludedPct).mul(100);
  });

  const monthlyQtys = splitQtyAcrossMonths(annualQtyKg, normPcts);

  const targetAnnualRevenueCents = annualQtyKg
    .mul(budgetUnitPricePerKg)
    .toDecimalPlaces(2, ROUND_HALF_UP)
    .mul(100)
    .toDecimalPlaces(0, ROUND_HALF_UP)
    .toNumber();

  const monthlyRevenues = splitRevenueAcrossMonths(
    monthlyQtys,
    budgetUnitPricePerKg,
    targetAnnualRevenueCents,
  );

  const months: PhasedMonth[] = [];

  for (let fm = 1; fm <= 12; fm++) {
    const qtyM = monthlyQtys[fm - 1]!;
    const revM = monthlyRevenues[fm - 1]!;
    const { year: calYear, month: calMonth } = calendarMonthForFiscalMonth(
      financialYear,
      fm,
      fiscalYearStartMonth,
    );

    if (!isCalendarMonthFullyInsideFy(calYear, calMonth, fyStartIso, fyEndIso)) {
      continue;
    }

    const calendarLabel = new Date(Date.UTC(calYear, calMonth - 1, 1)).toLocaleString("en-GB", {
      month: "short",
      year: "numeric",
    });

    const dayQtys = splitQtyAcrossDays(qtyM, calYear, calMonth);
    const isoDays = enumerateDaysInMonth(calYear, calMonth);
    const dayRevs = splitRevenueAcrossDays(dayQtys, budgetUnitPricePerKg, revM);

    const days: PhasedDay[] = isoDays.map((isoDate, idx) => {
      const { weekYear, week } = utcIsoWeekYearAndWeek(isoDate);
      return {
        isoDate,
        qtyKg: dayQtys[idx]!.toString(),
        revenue: dayRevs[idx]!.toFixed(2),
        isoWeekYear: weekYear,
        isoWeek: week,
      };
    });

    const weekMap = new Map<string, { wy: number; wk: number; qty: Decimal; rev: Decimal }>();
    for (let i = 0; i < days.length; i++) {
      const d0 = days[i]!;
      const key = `${d0.isoWeekYear}-W${String(d0.isoWeek).padStart(2, "0")}`;
      const cur = weekMap.get(key) ?? {
        wy: d0.isoWeekYear,
        wk: d0.isoWeek,
        qty: new Dec(0),
        rev: new Dec(0),
      };
      cur.qty = cur.qty.add(dayQtys[i]!);
      cur.rev = cur.rev.add(dayRevs[i]!);
      weekMap.set(key, cur);
    }
    const weeks: PhasedWeek[] = [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        isoWeekYear: v.wy,
        isoWeek: v.wk,
        label: key,
        qtyKg: v.qty.toString(),
        revenue: v.rev.toFixed(2),
      }));

    months.push({
      financialMonth: fm,
      calendarYear: calYear,
      calendarMonth: calMonth,
      calendarLabel,
      monthlyQtyKg: qtyM.toString(),
      monthlyRevenue: revM.toFixed(2),
      days,
      weeks,
    });
  }

  const phasedAnnualRev = monthlyRevenues.reduce((a, b) => a.add(b), new Dec(0));

  return {
    annualQtyKg: annualQtyKg.toString(),
    budgetUnitPricePerKg: budgetUnitPricePerKg.toString(),
    annualRevenue: phasedAnnualRev.toFixed(2),
    months,
  };
}

/**
 * Monthly phased budget quantities (kg) by fiscal month index 0..11 for one annual budget line.
 * Excluded fiscal months (not fully inside FY bounds) are 0; included months sum to annualQtyKg.
 */
export function computeMonthlyBudgetQtyKgByFiscalMonth(args: {
  financialYear: number;
  fiscalYearStartMonth: number;
  fyStartIso: IsoDate;
  fyEndIso: IsoDate;
  annualQtyKg: Decimal;
  fiscalMonthPercents: Decimal[];
}): Decimal[] {
  const {
    financialYear,
    fiscalYearStartMonth,
    fyStartIso,
    fyEndIso,
    annualQtyKg,
    fiscalMonthPercents,
  } = args;

  if (fiscalMonthPercents.length !== 12) {
    throw new Error("Expected 12 fiscal month percentages.");
  }

  const includedFiscalMonths: number[] = [];
  for (let fm = 1; fm <= 12; fm++) {
    const { year, month } = calendarMonthForFiscalMonth(
      financialYear,
      fm,
      fiscalYearStartMonth,
    );
    if (isCalendarMonthFullyInsideFy(year, month, fyStartIso, fyEndIso)) {
      includedFiscalMonths.push(fm);
    }
  }

  const sumIncludedPct = includedFiscalMonths.reduce(
    (s, fm) => s.add(fiscalMonthPercents[fm - 1]!),
    new Dec(0),
  );
  if (sumIncludedPct.lte(0)) {
    return Array.from({ length: 12 }, () => new Dec(0));
  }

  const normPcts = fiscalMonthPercents.map((p, i) => {
    const fm = i + 1;
    if (!includedFiscalMonths.includes(fm)) return new Dec(0);
    return p.div(sumIncludedPct).mul(100);
  });

  return splitQtyAcrossMonths(annualQtyKg, normPcts);
}

