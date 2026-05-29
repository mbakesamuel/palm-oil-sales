import { CustomerType, Prisma, ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  firstDayOfCalendarMonth,
  lastDayOfCalendarMonth,
  normalizeIsoDateInput,
  prismaDateToIso,
  utcIsoDateToday,
  type IsoDate,
} from "@/lib/posting-calendar";
import { resolveReportWorkingMonthFilter } from "@/lib/report-working-month-filter";
import {
  mergeWhereWithServiceScope,
  saleWhereForScope,
  resolveServiceScope,
} from "@/lib/service-scope";
import { utcIsoWeekYearAndWeek } from "@/lib/sales-budget-phase";
import {
  DAILY_SALES_CUSTOMER_TYPE_LABELS,
  DAILY_SALES_TYPE_ORDER,
  fmtKg,
} from "../daily-sales-summary/loader";

export { DAILY_SALES_CUSTOMER_TYPE_LABELS, DAILY_SALES_TYPE_ORDER, fmtKg };

export type SalesSummaryInterval = "daily" | "weekly" | "monthly" | "yearly";

export const SALES_SUMMARY_INTERVALS: SalesSummaryInterval[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

export const SALES_SUMMARY_INTERVAL_LABELS: Record<SalesSummaryInterval, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export type CustomerTypeCell = {
  qtyKg: Prisma.Decimal;
  revenueNet: Prisma.Decimal;
};

export type ProductSummaryBlock = {
  productId: number;
  productName: string;
  byType: Record<CustomerType, CustomerTypeCell>;
  total: CustomerTypeCell;
};

export type SalesSummaryByCustomerData = {
  interval: SalesSummaryInterval;
  scopedToSalesPoint: boolean;
  assignedSalesPointId: number | null;
  assignedSalesPointName: string | null;
  monthFilter: Awaited<
    ReturnType<typeof resolveReportWorkingMonthFilter>
  >["monthFilter"];
  monthFirstIso: string | null;
  monthLastIso: string | null;
  hasOpenFy: boolean;
  openFinancialYear: number | null;
  dateFromIso: string | null;
  dateToIso: string | null;
  dateInvalid: boolean;
  periodLabel: string;
  products: ProductSummaryBlock[];
  grandTotal: CustomerTypeCell;
  grandByType: Record<CustomerType, CustomerTypeCell>;
};

const z = new Prisma.Decimal(0);

function emptyCell(): CustomerTypeCell {
  return { qtyKg: z, revenueNet: z };
}

function emptyByType(): Record<CustomerType, CustomerTypeCell> {
  return {
    [CustomerType.INDUSTRY]: emptyCell(),
    [CustomerType.WHOLE_SALE]: emptyCell(),
    [CustomerType.RETAIL]: emptyCell(),
    [CustomerType.WORKER]: emptyCell(),
  };
}

function addCell(a: CustomerTypeCell, b: CustomerTypeCell): CustomerTypeCell {
  return {
    qtyKg: a.qtyKg.add(b.qtyKg),
    revenueNet: a.revenueNet.add(b.revenueNet),
  };
}

function utcInclusiveRange(fromIso: string, toIso: string): { gte: Date; lt: Date } {
  const gte = new Date(`${fromIso}T00:00:00.000Z`);
  const lt = new Date(`${toIso}T00:00:00.000Z`);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

function isoInRange(iso: IsoDate, from: IsoDate, to: IsoDate): boolean {
  return iso >= from && iso <= to;
}

function clipRange(
  fromIso: IsoDate,
  toIso: IsoDate,
  clipFrom: IsoDate,
  clipTo: IsoDate,
): { from: IsoDate; to: IsoDate } | null {
  const from = fromIso > clipFrom ? fromIso : clipFrom;
  const to = toIso < clipTo ? toIso : clipTo;
  if (from > to) return null;
  return { from, to };
}

/** Monday (ISO) through Sunday for the ISO week containing `isoDate`. */
function utcIsoWeekBounds(isoDate: IsoDate): { from: IsoDate; to: IsoDate; week: number; weekYear: number } {
  const { weekYear, week } = utcIsoWeekYearAndWeek(isoDate);
  const [ys, ms, ds] = isoDate.split("-").map((x) => Number.parseInt(x, 10));
  const date = new Date(Date.UTC(ys!, ms! - 1, ds!));
  const dayNr = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - dayNr);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    from: prismaDateToIso(monday),
    to: prismaDateToIso(sunday),
    week,
    weekYear,
  };
}

function parseInterval(raw: string | null | undefined): SalesSummaryInterval {
  const s = String(raw ?? "daily").trim().toLowerCase();
  if (s === "weekly" || s === "monthly" || s === "yearly") return s;
  return "daily";
}

function resolvePeriod(
  interval: SalesSummaryInterval,
  monthFilter: SalesSummaryByCustomerData["monthFilter"],
  monthFirstIso: string | null,
  monthLastIso: string | null,
  openFy: Awaited<ReturnType<typeof getOpenFinancialYearPeriod>>,
  dateRaw: string | null | undefined,
): {
  dateFromIso: string | null;
  dateToIso: string | null;
  dateInvalid: boolean;
  periodLabel: string;
  monthWhere: Prisma.SaleWhereInput;
} {
  if (interval === "yearly") {
    if (!openFy) {
      return {
        dateFromIso: null,
        dateToIso: null,
        dateInvalid: false,
        periodLabel: "",
        monthWhere: {},
      };
    }
    const from = prismaDateToIso(openFy.startDate);
    const to = prismaDateToIso(openFy.endDate);
    return {
      dateFromIso: from,
      dateToIso: to,
      dateInvalid: false,
      periodLabel: `Financial year ${openFy.financialYear} (${from} – ${to})`,
      monthWhere: { financialYear: openFy.financialYear },
    };
  }

  if (!monthFilter || !monthFirstIso || !monthLastIso) {
    return {
      dateFromIso: null,
      dateToIso: null,
      dateInvalid: Boolean(dateRaw),
      periodLabel: "",
      monthWhere: monthFilter
        ? {
            financialYear: monthFilter.financialYear,
            postingCalendarYear: monthFilter.postingCalendarYear,
            financialMonth: monthFilter.financialMonth,
          }
        : {},
    };
  }

  const monthWhere: Prisma.SaleWhereInput = {
    financialYear: monthFilter.financialYear,
    postingCalendarYear: monthFilter.postingCalendarYear,
    financialMonth: monthFilter.financialMonth,
  };

  if (interval === "monthly") {
    return {
      dateFromIso: monthFirstIso,
      dateToIso: monthLastIso,
      dateInvalid: false,
      periodLabel: `${monthFilter.label} (FY ${monthFilter.financialYear})`,
      monthWhere,
    };
  }

  if (interval === "weekly") {
    const today = utcIsoDateToday();
    const anchor = isoInRange(today, monthFirstIso, monthLastIso) ? today : monthLastIso;
    const week = utcIsoWeekBounds(anchor);
    const clipped = clipRange(week.from, week.to, monthFirstIso, monthLastIso);
    if (!clipped) {
      return {
        dateFromIso: null,
        dateToIso: null,
        dateInvalid: true,
        periodLabel: "",
        monthWhere,
      };
    }
    return {
      dateFromIso: clipped.from,
      dateToIso: clipped.to,
      dateInvalid: false,
      periodLabel: `ISO week ${week.week} · ${clipped.from} – ${clipped.to}`,
      monthWhere,
    };
  }

  // daily
  const picked = normalizeIsoDateInput(String(dateRaw ?? ""));
  const today = utcIsoDateToday();
  const defaultDay =
    today >= monthFirstIso && today <= monthLastIso ? today : monthLastIso;
  const dayIso = picked ?? defaultDay;
  const dateInvalid = Boolean(picked && !isoInRange(picked, monthFirstIso, monthLastIso));

  return {
    dateFromIso: dateInvalid ? null : dayIso,
    dateToIso: dateInvalid ? null : dayIso,
    dateInvalid,
    periodLabel: dateInvalid ? "" : dayIso,
    monthWhere,
  };
}

export function fmtXaf(d: Prisma.Decimal): string {
  if (!d || d.eq(0)) return "";
  const n = Number(d.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

export async function loadSalesSummaryByCustomer(
  session: AuthSession,
  rawParams?: { interval?: string | null; date?: string | null },
): Promise<SalesSummaryByCustomerData> {
  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;
  const interval = parseInterval(rawParams?.interval);

  const [{ monthFilter, hasOpenFy }, openFy, prisma] = await Promise.all([
    resolveReportWorkingMonthFilter(),
    getOpenFinancialYearPeriod(),
    getPrismaClient(),
  ]);

  const monthFirstIso = monthFilter
    ? firstDayOfCalendarMonth(
        monthFilter.postingCalendarYear,
        monthFilter.financialMonth,
      )
    : null;
  const monthLastIso = monthFilter
    ? lastDayOfCalendarMonth(
        monthFilter.postingCalendarYear,
        monthFilter.financialMonth,
      )
    : null;

  const { dateFromIso, dateToIso, dateInvalid, periodLabel, monthWhere } =
    resolvePeriod(
      interval,
      monthFilter,
      monthFirstIso,
      monthLastIso,
      openFy,
      rawParams?.date,
    );

  const scope = resolveServiceScope(session);
  const saleScopeBase: Prisma.SaleWhereInput =
    scopedToSalesPoint && assignedSalesPointId != null
      ? {
          salesPointId: assignedSalesPointId,
          vehicleNumber: { not: "BPO-OUTBOUND" },
        }
      : { vehicleNumber: { not: "BPO-OUTBOUND" } };

  const emptyResult = (): SalesSummaryByCustomerData => ({
    interval,
    scopedToSalesPoint,
    assignedSalesPointId,
    assignedSalesPointName,
    monthFilter,
    monthFirstIso,
    monthLastIso,
    hasOpenFy,
    openFinancialYear: openFy?.financialYear ?? null,
    dateFromIso,
    dateToIso,
    dateInvalid,
    periodLabel,
    products: [],
    grandTotal: emptyCell(),
    grandByType: emptyByType(),
  });

  if (!dateFromIso || !dateToIso || dateInvalid) {
    return emptyResult();
  }

  const { gte, lt } = utcInclusiveRange(dateFromIso, dateToIso);

  const sales = await prismaRetry(() =>
    prisma.sale.findMany({
      where: mergeWhereWithServiceScope(
        {
          ...saleScopeBase,
          ...monthWhere,
          status: ValidationStatus.VALIDATED,
          soldAt: { gte, lt },
          lines: {
            some: { product: { productCat: { isBottled: false } } },
          },
        },
        scope,
        saleWhereForScope,
      ),
      select: {
        customer: { select: { customerType: true } },
        lines: {
          where: { product: { productCat: { isBottled: false } } },
          select: {
            productId: true,
            qtyKg: true,
            lineNet: true,
            product: { select: { productName: true } },
          },
        },
      },
    }),
  );

  const byProduct = new Map<
    number,
    {
      productName: string;
      byType: Record<CustomerType, CustomerTypeCell>;
    }
  >();

  for (const sale of sales) {
    const customerType = sale.customer?.customerType ?? CustomerType.INDUSTRY;
    for (const line of sale.lines) {
      const existing = byProduct.get(line.productId) ?? {
        productName: line.product.productName,
        byType: emptyByType(),
      };
      const cell = existing.byType[customerType];
      existing.byType[customerType] = {
        qtyKg: cell.qtyKg.add(line.qtyKg),
        revenueNet: cell.revenueNet.add(line.lineNet),
      };
      byProduct.set(line.productId, existing);
    }
  }

  const products: ProductSummaryBlock[] = [...byProduct.entries()]
    .map(([productId, row]) => {
      let total = emptyCell();
      for (const t of DAILY_SALES_TYPE_ORDER) {
        total = addCell(total, row.byType[t]);
      }
      return {
        productId,
        productName: row.productName,
        byType: row.byType,
        total,
      };
    })
    .filter((p) => !p.total.qtyKg.eq(0) || !p.total.revenueNet.eq(0))
    .sort((a, b) => a.productName.localeCompare(b.productName));

  const grandByType = emptyByType();
  let grandTotal = emptyCell();
  for (const p of products) {
    for (const t of DAILY_SALES_TYPE_ORDER) {
      grandByType[t] = addCell(grandByType[t], p.byType[t]);
    }
    grandTotal = addCell(grandTotal, p.total);
  }

  return {
    interval,
    scopedToSalesPoint,
    assignedSalesPointId,
    assignedSalesPointName,
    monthFilter,
    monthFirstIso,
    monthLastIso,
    hasOpenFy,
    openFinancialYear: openFy?.financialYear ?? null,
    dateFromIso,
    dateToIso,
    dateInvalid,
    periodLabel,
    products,
    grandTotal,
    grandByType,
  };
}
