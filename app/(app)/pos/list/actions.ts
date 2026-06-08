"use server";

import { Prisma, ValidationStatus } from "@prisma/client";
import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-server";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { resolveReportWorkingMonthFilter } from "@/lib/report-working-month-filter";
import {
  commercialServiceErrorForOperations,
  commercialServiceErrorForResource,
  deliveryOrderWhereForScope,
  resolveServiceScope,
  saleWhereForScope,
} from "@/lib/service-scope";
import {
  fetchActorSalesPointScope,
  salesPointErrorForResource,
} from "@/lib/auth-sales-point-scope";
import {
  formatSaleProductSummary,
  formatSaleQtyTotals,
  sumSaleLineQuantities,
} from "@/lib/pos/sale-line-qty";
export type SalesListPeriod = "month" | "year" | "all";

export type SalesListFilters = {
  q?: string | null; // invoice no substring
  period?: SalesListPeriod;
};

export type SalesListRow = {
  id: string;
  invoiceNo: string;
  soldAtIso: string;
  salesPointName: string;
  deliveryOrderNo: string | null;
  deliveryOrderId: number | null;
  customerName: string;
  productSummary: string;
  status: ValidationStatus;
  totalQtyLabel: string;
  totalAmountXaf: string;
};

export type SalesListTotals = {
  count: number;
  totalQtyLabel: string;
  totalAmountXaf: string;
};

export type SalesListResult = {
  rows: SalesListRow[];
  totals: SalesListTotals;
  periodLabel: string;
};

function money2Print(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function fmtXaf(total: Prisma.Decimal) {
  if (!total || total.eq(0)) return "";
  return `${money2Print(total).toNumber().toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} XAF`;
}

export async function listSalesForOperations(input?: {
  filters?: SalesListFilters;
  take?: number;
}): Promise<SalesListResult> {
  await assertPermissionKey("route:/pos");
  await assertPermissionKey("route:/pos/list");

  const prisma = getPrismaClient();
  const session = await getServerSession();
  if (!session?.userId) {
    return {
      rows: [],
      totals: { count: 0, totalQtyLabel: "", totalAmountXaf: "" },
      periodLabel: "",
    };
  }

  const scope = resolveServiceScope(session);
  if (commercialServiceErrorForOperations(scope)) {
    return {
      rows: [],
      totals: { count: 0, totalQtyLabel: "", totalAmountXaf: "" },
      periodLabel: "",
    };
  }

  const actor = await fetchActorSalesPointScope(prisma, session.userId);
  if (!actor?.isActive) {
    return {
      rows: [],
      totals: { count: 0, totalQtyLabel: "", totalAmountXaf: "" },
      periodLabel: "",
    };
  }

  const filters = input?.filters ?? {};
  const take = Math.min(Math.max(Number(input?.take ?? 200) || 200, 50), 500);
  const q = String(filters.q ?? "").trim();
  const period: SalesListPeriod = filters.period ?? "month";

  let dateWhere: Prisma.SaleWhereInput = {};
  let periodLabel = "All time";

  const openPeriod = await getOpenFinancialYearPeriod();
  const { monthFilter } = await resolveReportWorkingMonthFilter();

  if (period === "month" && openPeriod && monthFilter != null) {
    dateWhere = {
      financialYear: monthFilter.financialYear,
      postingCalendarYear: monthFilter.postingCalendarYear,
      financialMonth: monthFilter.financialMonth,
    };
    periodLabel = `Current financial month (FY ${openPeriod.financialYear} · ${monthFilter.label})`;
  } else if (period === "year" && openPeriod) {
    dateWhere = { financialYear: openPeriod.financialYear };
    periodLabel = `Current financial year (FY ${openPeriod.financialYear})`;
  } else if (period === "all") {
    periodLabel = "All time";
  } else {
    periodLabel = openPeriod
      ? `Current financial year (FY ${openPeriod.financialYear})`
      : "All time";
    dateWhere = openPeriod ? { financialYear: openPeriod.financialYear } : {};
  }

  const scopeWhere = saleWhereForScope(scope) ?? {};

  const rowsRaw = await prisma.sale.findMany({
    where: {
      ...scopeWhere,
      ...dateWhere,
      vehicleNumber: { not: "BPO-OUTBOUND" },
      ...(q ? { invoiceNo: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ soldAt: "desc" }, { invoiceNo: "desc" }],
    take,
    select: {
      id: true,
      invoiceNo: true,
      soldAt: true,
      status: true,
      grossAmount: true,
      salesPointId: true,
      deliveryOrderNo: true,
      salesPoint: { select: { name: true } },
      customerNameSnapshot: true,
      commercialServiceId: true,
      saleProductMode: true,
      lines: {
        select: {
          qtyKg: true,
          qtyUnits: true,
          product: { select: { productName: true } },
        },
      },
    },
  });

  const doNos = [
    ...new Set(
      rowsRaw
        .map((r) => r.deliveryOrderNo?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ];
  const salesPointIds = [
    ...new Set(
      rowsRaw
        .map((r) => r.salesPointId)
        .filter((id): id is number => id != null),
    ),
  ];

  const deliveryOrdersByKey = new Map<
    string,
    { id: number; deliveryOrderNo: string }
  >();
  const doScopeWhere = deliveryOrderWhereForScope(scope) ?? {};

  if (doNos.length > 0 && salesPointIds.length > 0) {
    const orders = await prisma.deliveryOrder.findMany({
      where: {
        ...doScopeWhere,
        deliveryOrderNo: { in: doNos },
        salesPointId: { in: salesPointIds },
      },
      select: {
        id: true,
        deliveryOrderNo: true,
        salesPointId: true,
        commercialServiceId: true,
      },
    });
    for (const o of orders) {
      if (commercialServiceErrorForResource(scope, o.commercialServiceId)) continue;
      deliveryOrdersByKey.set(`${o.salesPointId}:${o.deliveryOrderNo}`, {
        id: o.id,
        deliveryOrderNo: o.deliveryOrderNo,
      });
    }
  }

  const rows: SalesListRow[] = [];
  let total = new Prisma.Decimal(0);
  const qtyTotals = { kg: 0, units: 0 };

  for (const r of rowsRaw) {
    if (salesPointErrorForResource(actor, r.salesPointId)) continue;
    if (commercialServiceErrorForResource(scope, r.commercialServiceId)) continue;

    const rowTotal = r.grossAmount ?? new Prisma.Decimal(0);
    const rowQty = sumSaleLineQuantities(r.saleProductMode, r.lines);
    total = total.add(rowTotal);
    qtyTotals.kg += rowQty.kg;
    qtyTotals.units += rowQty.units;

    const doKey =
      r.salesPointId != null && r.deliveryOrderNo?.trim()
        ? `${r.salesPointId}:${r.deliveryOrderNo.trim()}`
        : null;
    const matchedDo = doKey ? deliveryOrdersByKey.get(doKey) : undefined;

    rows.push({
      id: r.id,
      invoiceNo: r.invoiceNo,
      soldAtIso: r.soldAt.toISOString().slice(0, 10),
      salesPointName: r.salesPoint?.name ?? "",
      deliveryOrderNo: matchedDo?.deliveryOrderNo ?? null,
      deliveryOrderId: matchedDo?.id ?? null,
      customerName: r.customerNameSnapshot,
      productSummary: formatSaleProductSummary(r.lines),
      status: r.status,
      totalQtyLabel: formatSaleQtyTotals(rowQty),
      totalAmountXaf: fmtXaf(rowTotal),
    });
  }

  return {
    rows,
    totals: {
      count: rows.length,
      totalQtyLabel: formatSaleQtyTotals(qtyTotals),
      totalAmountXaf: fmtXaf(total),
    },
    periodLabel,
  };
}
