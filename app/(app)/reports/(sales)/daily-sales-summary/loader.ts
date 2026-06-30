import { Prisma, ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import {
  listCustomerTypeDefinitions,
  resolveDefaultCustomerTypeId,
} from "@/lib/customer-types/catalog";
import type { CustomerTypeOption } from "@/lib/customer-types/types";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  firstDayOfCalendarMonth,
  lastDayOfCalendarMonth,
  normalizeIsoDateInput,
  utcIsoDateToday,
} from "@/lib/posting-calendar";
import { saleWhereExcludingPosPlaceholderCustomers } from "@/lib/customers/operational-customer-scope";
import {
  resolveReportMonthFilter,
  type ReportMonthSnapshot,
} from "@/lib/report-working-month-filter";
import type { SelectableMonth } from "@/lib/posting-calendar";

const z = new Prisma.Decimal(0);

export type DailySaleRow = {
  id: string;
  invoiceNo: string;
  soldAt: Date;
  dateIssued: Date;
  vehicleNumber: string;
  deliveryOrderNo: string | null;
  customerNameSnapshot: string;
  customer: {
    customerTypeId: string;
    customerTypeDefinition: CustomerTypeOption;
    name: string;
  } | null;
  qtyKg: Prisma.Decimal;
  customerTypeId: string;
  customerTypeCode: string;
  customerTypeName: string;
};

export type DailySummaryReportData = {
  scopedToSalesPoint: boolean;
  assignedSalesPointId: number | null;
  assignedSalesPointName: string | null;
  monthFilter: Awaited<
    ReturnType<typeof resolveReportMonthFilter>
  >["monthFilter"];
  /** Inclusive calendar bounds for the selected month (UTC ISO dates). */
  monthFirstIso: string | null;
  monthLastIso: string | null;
  hasOpenFy: boolean;
  monthInvalid: boolean;
  selectableMonths: SelectableMonth[];
  workingMonth: ReportMonthSnapshot | null;
  /** @deprecated Use `dateFromIso` / `dateToIso`; kept when from === to. */
  selectedIso: string | null;
  dateFromIso: string | null;
  dateToIso: string | null;
  dateInvalid: boolean;
  rangeInvalid: boolean;
  customerTypeOptions: CustomerTypeOption[];
  rows: DailySaleRow[];
  totalsByType: Map<string, Prisma.Decimal>;
  grandQty: Prisma.Decimal;
  doMetaByNo: Map<string, { dateIssued: Date; balanceKg: Prisma.Decimal }>;
};

export type DailySalesSummaryDateParams = {
  date?: string | null;
  from?: string | null;
  to?: string | null;
  year?: string | null;
  month?: string | null;
};

function utcInclusiveRange(fromIso: string, toIso: string): { gte: Date; lt: Date } {
  const gte = new Date(`${fromIso}T00:00:00.000Z`);
  const lt = new Date(`${toIso}T00:00:00.000Z`);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

function isoInMonth(iso: string, monthFirst: string, monthLast: string): boolean {
  return iso >= monthFirst && iso <= monthLast;
}

function resolveDailySalesDateRange(
  raw: DailySalesSummaryDateParams,
  monthFilter: DailySummaryReportData["monthFilter"],
): {
  dateFromIso: string | null;
  dateToIso: string | null;
  dateInvalid: boolean;
  rangeInvalid: boolean;
} {
  const legacy = normalizeIsoDateInput(String(raw.date ?? ""));
  const fromRaw = normalizeIsoDateInput(String(raw.from ?? legacy ?? ""));
  const toRaw = normalizeIsoDateInput(String(raw.to ?? raw.from ?? legacy ?? ""));

  if (!monthFilter) {
    return {
      dateFromIso: null,
      dateToIso: null,
      dateInvalid: Boolean(fromRaw || toRaw || legacy),
      rangeInvalid: false,
    };
  }

  const monthFirst = firstDayOfCalendarMonth(
    monthFilter.postingCalendarYear,
    monthFilter.financialMonth,
  );
  const monthLast = lastDayOfCalendarMonth(
    monthFilter.postingCalendarYear,
    monthFilter.financialMonth,
  );

  let dateInvalid = false;
  let rangeInvalid = false;

  let dateFromIso: string | null = null;
  let dateToIso: string | null = null;

  if (fromRaw || toRaw) {
    const fromCandidate = fromRaw || toRaw;
    const toCandidate = toRaw || fromRaw;
    if (
      !fromCandidate ||
      !toCandidate ||
      !isoInMonth(fromCandidate, monthFirst, monthLast) ||
      !isoInMonth(toCandidate, monthFirst, monthLast)
    ) {
      dateInvalid = true;
    } else if (fromCandidate > toCandidate) {
      rangeInvalid = true;
    } else {
      dateFromIso = fromCandidate;
      dateToIso = toCandidate;
    }
  } else {
    const today = utcIsoDateToday();
    const endDefault = today >= monthFirst && today <= monthLast ? today : monthLast;
    dateFromIso = monthFirst;
    dateToIso = endDefault;
  }

  return { dateFromIso, dateToIso, dateInvalid, rangeInvalid };
}

export function formatDailySalesDateRangeLabel(
  fromIso: string | null,
  toIso: string | null,
): string | null {
  if (!fromIso || !toIso) return null;
  if (fromIso === toIso) return fromIso;
  return `${fromIso} – ${toIso}`;
}

function invoicedKgByProductFromSales(
  validatedSales: Array<{
    lines: Array<{ productId: number; qtyKg: Prisma.Decimal }>;
  }>,
): Map<number, Prisma.Decimal> {
  const map = new Map<number, Prisma.Decimal>();
  for (const s of validatedSales) {
    for (const l of s.lines) {
      map.set(l.productId, (map.get(l.productId) ?? z).add(l.qtyKg));
    }
  }
  return map;
}

function doBalanceKgTotal(
  details: Array<{ productId: number; orderQty: number }>,
  invoicedKgByProduct: Map<number, Prisma.Decimal>,
): Prisma.Decimal {
  let acc = z;
  for (const d of details) {
    const inv = invoicedKgByProduct.get(d.productId) ?? z;
    acc = acc.add(new Prisma.Decimal(d.orderQty).sub(inv));
  }
  return acc;
}

/** Load the daily-sales-summary report dataset for the active session. */
export async function loadDailySalesSummary(
  session: AuthSession,
  rawParams?: DailySalesSummaryDateParams | string | null,
): Promise<DailySummaryReportData> {
  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  const params: DailySalesSummaryDateParams =
    typeof rawParams === "string"
      ? { date: rawParams }
      : (rawParams ?? {});

  const yearParam = params.year?.trim();
  const monthParam = params.month?.trim();
  const calendarYear =
    yearParam && /^\d{4}$/.test(yearParam) ? Number.parseInt(yearParam, 10) : undefined;
  const calendarMonth =
    monthParam && /^\d{1,2}$/.test(monthParam)
      ? Number.parseInt(monthParam, 10)
      : undefined;

  const [
    { monthFilter, hasOpenFy, monthInvalid, selectableMonths, workingMonth },
    prisma,
    customerTypeOptions,
    defaultCustomerTypeId,
  ] = await Promise.all([
    resolveReportMonthFilter(session, {
      calendarYear,
      calendarMonth,
    }),
    getPrismaClient(),
    listCustomerTypeDefinitions({ activeOnly: true }),
    resolveDefaultCustomerTypeId(),
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

  const { dateFromIso, dateToIso, dateInvalid, rangeInvalid } =
    resolveDailySalesDateRange(params, monthFilter);

  const selectedIso =
    dateFromIso && dateToIso && dateFromIso === dateToIso ? dateFromIso : null;

  const saleScope: Prisma.SaleWhereInput =
    scopedToSalesPoint && assignedSalesPointId != null
      ? {
          salesPointId: assignedSalesPointId,
          vehicleNumber: { not: "BPO-OUTBOUND" },
        }
      : { vehicleNumber: { not: "BPO-OUTBOUND" } };

  const monthWhere: Prisma.SaleWhereInput = monthFilter
    ? {
        financialYear: monthFilter.financialYear,
        postingCalendarYear: monthFilter.postingCalendarYear,
        financialMonth: monthFilter.financialMonth,
      }
    : {};

  let sales: Array<{
    id: string;
    invoiceNo: string;
    soldAt: Date;
    dateIssued: Date;
    vehicleNumber: string;
    deliveryOrderNo: string | null;
    customerNameSnapshot: string;
    customer: {
      customerTypeId: string;
      customerTypeDefinition: CustomerTypeOption;
      name: string;
    } | null;
    lines: Array<{ qtyKg: Prisma.Decimal }>;
  }> = [];

  let doMetaByNo = new Map<
    string,
    { dateIssued: Date; balanceKg: Prisma.Decimal }
  >();

  if (dateFromIso && dateToIso && !dateInvalid && !rangeInvalid) {
    const { gte, lt } = utcInclusiveRange(dateFromIso, dateToIso);
    sales = await prismaRetry(() =>
      prisma.sale.findMany({
        where: saleWhereExcludingPosPlaceholderCustomers({
          ...saleScope,
          ...monthWhere,
          status: ValidationStatus.VALIDATED,
          soldAt: { gte, lt },
        }),
        orderBy: [{ soldAt: "asc" }, { invoiceNo: "asc" }],
        select: {
          id: true,
          invoiceNo: true,
          soldAt: true,
          dateIssued: true,
          vehicleNumber: true,
          deliveryOrderNo: true,
          customerNameSnapshot: true,
          customer: {
            select: {
              customerTypeId: true,
              name: true,
              customerTypeDefinition: { select: { id: true, code: true, name: true } },
            },
          },
          lines: { select: { qtyKg: true } },
        },
      }),
    );

    const doNos = [
      ...new Set(
        sales
          .map((s) => s.deliveryOrderNo)
          .filter((n): n is string => Boolean(n)),
      ),
    ];

    if (doNos.length > 0) {
      const [orders, validatedSalesForDos] = await Promise.all([
        prismaRetry(() =>
          prisma.deliveryOrder.findMany({
            where: { deliveryOrderNo: { in: doNos } },
            select: {
              deliveryOrderNo: true,
              dateIssued: true,
              details: { select: { productId: true, orderQty: true } },
            },
          }),
        ),
        prismaRetry(() =>
          prisma.sale.findMany({
            where: {
              deliveryOrderNo: { in: doNos },
              status: ValidationStatus.VALIDATED,
              ...saleScope,
            },
            select: {
              deliveryOrderNo: true,
              lines: { select: { productId: true, qtyKg: true } },
            },
          }),
        ),
      ]);

      const validatedByDo = new Map<string, typeof validatedSalesForDos>();
      for (const s of validatedSalesForDos) {
        const k = s.deliveryOrderNo ?? "";
        if (!k) continue;
        const arr = validatedByDo.get(k) ?? [];
        arr.push(s);
        validatedByDo.set(k, arr);
      }

      doMetaByNo = new Map();
      for (const o of orders) {
        const invMap = invoicedKgByProductFromSales(
          validatedByDo.get(o.deliveryOrderNo) ?? [],
        );
        const balanceKg = doBalanceKgTotal(o.details, invMap);
        doMetaByNo.set(o.deliveryOrderNo, {
          dateIssued: o.dateIssued,
          balanceKg,
        });
      }
    }
  }

  const defaultType =
    customerTypeOptions.find((o) => o.id === defaultCustomerTypeId) ??
    customerTypeOptions[0];

  const rows: DailySaleRow[] = sales.map((s) => {
    const typeDef = s.customer?.customerTypeDefinition ?? defaultType;
    const customerTypeId = s.customer?.customerTypeId ?? defaultCustomerTypeId;
    return {
      ...s,
      qtyKg: s.lines.reduce((a, l) => a.add(l.qtyKg), z),
      customerTypeId,
      customerTypeCode: typeDef?.code ?? "INDUSTRY",
      customerTypeName: typeDef?.name ?? "Industry",
    };
  });

  const totalsByType = new Map<string, Prisma.Decimal>();
  for (const r of rows) {
    totalsByType.set(
      r.customerTypeId,
      (totalsByType.get(r.customerTypeId) ?? z).add(r.qtyKg),
    );
  }
  const grandQty = rows.reduce((a, r) => a.add(r.qtyKg), z);

  return {
    scopedToSalesPoint,
    assignedSalesPointId,
    assignedSalesPointName,
    monthFilter,
    monthFirstIso,
    monthLastIso,
    hasOpenFy,
    monthInvalid,
    selectableMonths,
    workingMonth,
    selectedIso,
    dateFromIso,
    dateToIso,
    dateInvalid,
    rangeInvalid,
    customerTypeOptions,
    rows,
    totalsByType,
    grandQty,
    doMetaByNo,
  };
}

export function fmtKg(d: Prisma.Decimal): string {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(d: Date): string {
  return d.toLocaleString("en-GB", { dateStyle: "medium" });
}
