import "server-only";

import { Prisma, ValidationStatus, type PosSaleDisposition } from "@prisma/client";
import { effectiveSaleDisposition } from "@/lib/pos/sale-disposition";
import type { AuthSession } from "@/lib/auth-session";
import {
  listCustomerTypeDefinitions,
  resolveDefaultCustomerTypeId,
} from "@/lib/customer-types/catalog";
import type { CustomerTypeOption } from "@/lib/customer-types/types";
import { crosstabColumnLabel } from "@/lib/customer-types/types";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  firstDayOfCalendarMonth,
  lastDayOfCalendarMonth,
} from "@/lib/posting-calendar";
import { resolveReportWorkingMonthFilter } from "@/lib/report-working-month-filter";
import {
  mergeWhereWithServiceScope,
  resolveServiceScope,
  saleWhereForScope,
} from "@/lib/service-scope";
import { fmtKg } from "../daily-sales-summary/loader";

const z = new Prisma.Decimal(0);

export const SPECIAL_CROSSTAB_COLUMNS = [
  { key: "STAFF", label: "STAFF" },
  { key: "TRNSFR", label: "TRNSFR" },
  { key: "PUBLIC_REL", label: "PUBLIC REL" },
] as const;

export type SpecialCrosstabColumnKey = (typeof SPECIAL_CROSSTAB_COLUMNS)[number]["key"];

export type DailyCrosstabColumn = {
  key: string;
  label: string;
};

export type DailyCrosstabColumnKey = string;

export type DailyCrosstabFilterOption = { value: string; label: string };

export type DailyCrosstabDayRow = {
  day: number;
  cells: Record<string, Prisma.Decimal>;
  total: Prisma.Decimal;
};

export type DailyCrosstabReportData = {
  scopedToSalesPoint: boolean;
  assignedSalesPointId: number | null;
  assignedSalesPointName: string | null;
  salesPointOptions: DailyCrosstabFilterOption[];
  selectedSalesPointId: string;
  selectedSalesPointName: string | null;
  salesPointInvalid: boolean;
  monthFilter: Awaited<
    ReturnType<typeof resolveReportWorkingMonthFilter>
  >["monthFilter"];
  monthFirstIso: string | null;
  monthLastIso: string | null;
  hasOpenFy: boolean;
  daysInMonth: number;
  columns: DailyCrosstabColumn[];
  rows: DailyCrosstabDayRow[];
  colTotals: Record<string, Prisma.Decimal>;
  grandTotal: Prisma.Decimal;
};

function emptyCells(columns: DailyCrosstabColumn[]): Record<string, Prisma.Decimal> {
  const out: Record<string, Prisma.Decimal> = {};
  for (const col of columns) out[col.key] = z;
  return out;
}

function buildCrosstabColumns(customerTypeOptions: CustomerTypeOption[]): DailyCrosstabColumn[] {
  const typeCols = customerTypeOptions.map((opt) => ({
    key: opt.code,
    label: crosstabColumnLabel(opt),
  }));
  return [...typeCols, ...SPECIAL_CROSSTAB_COLUMNS];
}

function parseOptionalSalesPointId(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function utcDayOfMonth(d: Date): number {
  return d.getUTCDate();
}

function daysInCalendarMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Map a validated sale to one daily crosstab column key. */
export function classifySaleForDailyCrosstab(
  sale: {
    vehicleNumber: string;
    saleDisposition: PosSaleDisposition | null;
    customer: {
      customerTypeId: string;
      customerTypeDefinition: CustomerTypeOption;
    } | null;
    payments: Array<{ paymentMethod: { code: string } }>;
  },
  defaultCustomerTypeId: string,
): DailyCrosstabColumnKey {
  if (effectiveSaleDisposition(sale.saleDisposition) === "PUBLIC_RELATION") {
    return "PUBLIC_REL";
  }
  if (sale.vehicleNumber === "BPO-OUTBOUND") return "TRNSFR";
  if (sale.payments.some((p) => p.paymentMethod.code === "CREDIT")) return "STAFF";
  const typeDef = sale.customer?.customerTypeDefinition;
  if (typeDef?.code) return typeDef.code;
  return sale.customer?.customerTypeId ?? defaultCustomerTypeId;
}

export async function loadDailySalesCrosstab(
  session: AuthSession,
  searchParams?: { salesPointId?: string },
): Promise<DailyCrosstabReportData | { type: "no-sales-point" }> {
  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return { type: "no-sales-point" };
  }

  const selectedSalesPointIdRaw = searchParams?.salesPointId?.trim() ?? "";
  const filterSalesPointId = scopedToSalesPoint
    ? assignedSalesPointId
    : parseOptionalSalesPointId(selectedSalesPointIdRaw);

  const [{ monthFilter, hasOpenFy }, prisma, scope, customerTypeOptions, defaultCustomerTypeId] =
    await Promise.all([
      resolveReportWorkingMonthFilter(),
      getPrismaClient(),
      Promise.resolve(resolveServiceScope(session)),
      listCustomerTypeDefinitions({ activeOnly: true }),
      resolveDefaultCustomerTypeId(),
    ]);

  const columns = buildCrosstabColumns(customerTypeOptions);
  const defaultTypeCode =
    customerTypeOptions.find((o) => o.id === defaultCustomerTypeId)?.code ?? "INDUSTRY";

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

  const daysInMonth =
    monthFilter != null
      ? daysInCalendarMonth(
          monthFilter.postingCalendarYear,
          monthFilter.financialMonth,
        )
      : 0;

  const [salesPointOptions, salesPoints] = await Promise.all([
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        where:
          scopedToSalesPoint && assignedSalesPointId != null
            ? { id: assignedSalesPointId }
            : {},
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ),
  ]);

  const validSalesPointIds = new Set(salesPoints.map((s) => s.id));
  const salesPointInvalid =
    !scopedToSalesPoint &&
    filterSalesPointId != null &&
    !validSalesPointIds.has(filterSalesPointId);

  const effectiveSalesPointId =
    scopedToSalesPoint && assignedSalesPointId != null
      ? assignedSalesPointId
      : salesPointInvalid
        ? null
        : (filterSalesPointId ??
          (salesPointOptions[0] ? salesPointOptions[0].id : null));

  const selectedSalesPointId =
    effectiveSalesPointId != null ? String(effectiveSalesPointId) : "";
  const selectedSalesPointName =
    effectiveSalesPointId != null
      ? (salesPoints.find((s) => s.id === effectiveSalesPointId)?.name ?? null)
      : null;

  const rowMap = new Map<number, DailyCrosstabDayRow>();
  for (let day = 1; day <= daysInMonth; day++) {
    rowMap.set(day, { day, cells: emptyCells(columns), total: z });
  }

  const colTotals = emptyCells(columns);
  let grandTotal = z;

  if (
    monthFilter &&
    monthFirstIso &&
    monthLastIso &&
    effectiveSalesPointId != null &&
    !salesPointInvalid
  ) {
    const gte = new Date(`${monthFirstIso}T00:00:00.000Z`);
    const lt = new Date(`${monthLastIso}T00:00:00.000Z`);
    lt.setUTCDate(lt.getUTCDate() + 1);

    const sales = await prismaRetry(() =>
      prisma.sale.findMany({
        where: mergeWhereWithServiceScope(
          {
            status: ValidationStatus.VALIDATED,
            salesPointId: effectiveSalesPointId,
            financialYear: monthFilter.financialYear,
            postingCalendarYear: monthFilter.postingCalendarYear,
            financialMonth: monthFilter.financialMonth,
            soldAt: { gte, lt },
          },
          scope,
          saleWhereForScope,
        ),
        select: {
          soldAt: true,
          vehicleNumber: true,
          saleDisposition: true,
          customer: {
            select: {
              customerTypeId: true,
              customerTypeDefinition: { select: { id: true, code: true, name: true } },
            },
          },
          payments: {
            select: { paymentMethod: { select: { code: true } } },
          },
          lines: { select: { qtyKg: true } },
        },
      }),
    );

    for (const sale of sales) {
      const qty = sale.lines.reduce((acc, l) => acc.add(l.qtyKg), z);
      if (qty.equals(z)) continue;

      const day = utcDayOfMonth(sale.soldAt);
      const row = rowMap.get(day);
      if (!row) continue;

      let col = classifySaleForDailyCrosstab(sale, defaultCustomerTypeId);
      if (!columns.some((c) => c.key === col)) {
        col = defaultTypeCode;
      }
      row.cells[col] = (row.cells[col] ?? z).add(qty);
      row.total = row.total.add(qty);
      colTotals[col] = (colTotals[col] ?? z).add(qty);
      grandTotal = grandTotal.add(qty);
    }
  }

  const rows = [...rowMap.values()].sort((a, b) => a.day - b.day);

  return {
    scopedToSalesPoint,
    assignedSalesPointId,
    assignedSalesPointName,
    salesPointOptions: salesPointOptions.map((s) => ({
      value: String(s.id),
      label: s.name,
    })),
    selectedSalesPointId,
    selectedSalesPointName,
    salesPointInvalid,
    monthFilter,
    monthFirstIso,
    monthLastIso,
    hasOpenFy,
    daysInMonth,
    columns,
    rows,
    colTotals,
    grandTotal,
  };
}

export { fmtKg };
