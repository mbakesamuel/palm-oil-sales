"use server";

import { Prisma, ValidationStatus } from "@prisma/client";
import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-server";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { WORKING_CAL_COOKIE, parseWorkingCalCookie } from "@/lib/working-period-cookie";
import {
  commercialServiceErrorForOperations,
  commercialServiceErrorForResource,
  deliveryOrderWhereForScope,
  resolveServiceScope,
} from "@/lib/service-scope";
import {
  fetchActorSalesPointScope,
  salesPointErrorForResource,
} from "@/lib/auth-sales-point-scope";
import { cookies } from "next/headers";

export type DeliveryOrdersListPeriod = "month" | "year" | "all";

export type DeliveryOrdersListFilters = {
  q?: string | null; // DO no substring
  period?: DeliveryOrdersListPeriod;
};

export type DeliveryOrdersListRow = {
  id: number;
  deliveryOrderNo: string;
  dateIssuedIso: string;
  salesPointName: string;
  customerName: string;
  status: ValidationStatus;
  totalQty: number;
  totalQtyLabel: string;
  totalAmountXaf: string;
};

export type DeliveryOrdersListTotals = {
  count: number;
  totalQty: number;
  totalAmountXaf: string;
};

export type DeliveryOrdersListResult = {
  rows: DeliveryOrdersListRow[];
  totals: DeliveryOrdersListTotals;
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

export async function listDeliveryOrdersForOperations(input?: {
  filters?: DeliveryOrdersListFilters;
  take?: number;
}): Promise<DeliveryOrdersListResult> {
  await assertPermissionKey("route:/delivery-orders");
  await assertPermissionKey("route:/delivery-orders/list");

  const prisma = getPrismaClient();
  const session = await getServerSession();
  if (!session?.userId) {
    return {
      rows: [],
      totals: { count: 0, totalQty: 0, totalAmountXaf: "" },
      periodLabel: "",
    };
  }

  const scope = resolveServiceScope(session);
  if (commercialServiceErrorForOperations(scope)) {
    return {
      rows: [],
      totals: { count: 0, totalQty: 0, totalAmountXaf: "" },
      periodLabel: "",
    };
  }

  const actor = await fetchActorSalesPointScope(prisma, session.userId);
  if (!actor?.isActive) {
    return {
      rows: [],
      totals: { count: 0, totalQty: 0, totalAmountXaf: "" },
      periodLabel: "",
    };
  }

  const filters = input?.filters ?? {};
  const take = Math.min(Math.max(Number(input?.take ?? 200) || 200, 50), 500);
  const q = String(filters.q ?? "").trim();
  const period: DeliveryOrdersListPeriod = filters.period ?? "month";

  let dateIssuedWhere: Prisma.DeliveryOrderWhereInput = {};
  let periodLabel = "All time";

  // "Financial month/year" = open FY + user's working calendar month (cookie),
  // since DOs are posted with financialYear + financialMonth.
  const openPeriod = await getOpenFinancialYearPeriod();
  const ck = await cookies();
  const cal = parseWorkingCalCookie(ck.get(WORKING_CAL_COOKIE)?.value);
  const workingYear = cal?.year;
  const workingMonth = cal?.month;

  if (period === "month" && openPeriod && workingMonth != null) {
    dateIssuedWhere = {
      financialYear: openPeriod.financialYear,
      financialMonth: workingMonth,
    };
    periodLabel = `Current financial month (FY ${openPeriod.financialYear} · M${String(workingMonth).padStart(2, "0")})`;
  } else if (period === "year" && openPeriod) {
    dateIssuedWhere = { financialYear: openPeriod.financialYear };
    periodLabel = `Current financial year (FY ${openPeriod.financialYear})`;
  } else if (period === "all") {
    periodLabel = "All time";
  } else {
    // Fallback when cookies/open period missing
    periodLabel = openPeriod
      ? `Current financial year (FY ${openPeriod.financialYear})`
      : "All time";
    dateIssuedWhere = openPeriod ? { financialYear: openPeriod.financialYear } : {};
  }

  const scopeWhere = deliveryOrderWhereForScope(scope) ?? {};

  const rowsRaw = await prisma.deliveryOrder.findMany({
    where: {
      ...scopeWhere,
      ...dateIssuedWhere,
      ...(q ? { deliveryOrderNo: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ dateIssued: "desc" }, { deliveryOrderNo: "desc" }],
    take,
    select: {
      id: true,
      deliveryOrderNo: true,
      dateIssued: true,
      status: true,
      salesPointId: true,
      salesPoint: { select: { name: true } },
      customer: { select: { name: true } },
      details: { select: { amount: true, orderQty: true } },
      commercialServiceId: true,
    },
  });

  const rows: DeliveryOrdersListRow[] = [];
  let total = new Prisma.Decimal(0);
  let totalQty = 0;

  for (const r of rowsRaw) {
    if (salesPointErrorForResource(actor, r.salesPointId)) continue;
    if (commercialServiceErrorForResource(scope, r.commercialServiceId)) continue;

    const rowTotal = r.details.reduce(
      (acc, d) => acc.add(d.amount ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );
    const rowQty = r.details.reduce((acc, d) => acc + (d.orderQty ?? 0), 0);
    total = total.add(rowTotal);
    totalQty += rowQty;

    rows.push({
      id: r.id,
      deliveryOrderNo: r.deliveryOrderNo,
      dateIssuedIso: r.dateIssued.toISOString().slice(0, 10),
      salesPointName: r.salesPoint.name,
      customerName: r.customer.name,
      status: r.status,
      totalQty: rowQty,
      totalQtyLabel: rowQty ? rowQty.toLocaleString(undefined) : "",
      totalAmountXaf: fmtXaf(rowTotal),
    });
  }

  return {
    rows,
    totals: { count: rows.length, totalQty, totalAmountXaf: fmtXaf(total) },
    periodLabel,
  };
}

