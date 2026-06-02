import "server-only";

import { Prisma, StockDocStatus, ValidationStatus } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import type { ReportMonthFilter } from "@/lib/report-working-month-filter";
import {
  deliveryOrderWhereForScope,
  saleWhereForScope,
  type ServiceScope,
} from "@/lib/service-scope";
import type {
  DashboardKpis,
  IncomingTransferRow,
  StatusSlice,
  StockKpis,
  TrendPoint,
} from "@/lib/dashboard/types";

export type {
  DashboardKpis,
  IncomingTransferRow,
  StatusSlice,
  StockKpis,
  TrendPoint,
} from "@/lib/dashboard/types";
export { formatXaf } from "@/lib/dashboard/format";

function last12MonthBuckets(): Array<{ year: number; month: number; label: string }> {
  const buckets: Array<{ year: number; month: number; label: string }> = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.push({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      label: d.toLocaleString("en-GB", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
    });
  }
  return buckets;
}

function monthKey(year: number, month: number) {
  return `${year}-${month}`;
}

function mergeScopeWhere<T extends object>(
  base: T,
  scopeFilter: Prisma.SaleWhereInput | Prisma.DeliveryOrderWhereInput | undefined,
): T {
  if (!scopeFilter) return base;
  return { AND: [base, scopeFilter] } as T;
}

function monthFilterWhere(monthFilter: ReportMonthFilter | null) {
  if (!monthFilter) return {};
  return {
    financialYear: monthFilter.financialYear,
    postingCalendarYear: monthFilter.postingCalendarYear,
    financialMonth: monthFilter.financialMonth,
  };
}

export async function getDashboardKpis(
  scope: ServiceScope,
  monthFilter: ReportMonthFilter | null,
  salesPointId?: number | null,
): Promise<DashboardKpis> {
  const prisma = getPrismaClient();
  const saleBase: Prisma.SaleWhereInput = {
    vehicleNumber: { not: "BPO-OUTBOUND" },
    ...(salesPointId != null ? { salesPointId } : {}),
    ...monthFilterWhere(monthFilter),
  };
  const saleWhere = mergeScopeWhere(saleBase, saleWhereForScope(scope));

  const doBase: Prisma.DeliveryOrderWhereInput = {
    ...(salesPointId != null ? { salesPointId } : {}),
    ...monthFilterWhere(monthFilter),
  };
  const doWhere = mergeScopeWhere(doBase, deliveryOrderWhereForScope(scope));

  const [saleCount, grossAgg, pendingDoCount, pendingSaleCount, validatedSaleCount] =
    await Promise.all([
      prisma.sale.count({ where: saleWhere }),
      prisma.sale.aggregate({ where: saleWhere, _sum: { grossAmount: true } }),
      prisma.deliveryOrder.count({
        where: { ...doWhere, status: ValidationStatus.PENDING },
      }),
      prisma.sale.count({
        where: {
          AND: [
            saleWhere,
            { status: ValidationStatus.PENDING },
            {
              lines: {
                some: { product: { productCat: { isBottled: false } } },
              },
            },
          ],
        },
      }),
      prisma.sale.count({
        where: { ...saleWhere, status: ValidationStatus.VALIDATED },
      }),
    ]);

  const grossValue = Number.parseFloat(String(grossAgg._sum.grossAmount ?? 0)) || 0;
  const validatedRatePct =
    saleCount > 0 ? Math.round((validatedSaleCount / saleCount) * 10000) / 100 : null;

  return {
    saleCount,
    grossValue,
    pendingDoCount,
    pendingSaleCount,
    validatedSaleCount,
    validatedRatePct,
  };
}

export async function getSalesTrendByMonth(
  scope: ServiceScope,
  salesPointId?: number | null,
): Promise<TrendPoint[]> {
  const prisma = getPrismaClient();
  const buckets = last12MonthBuckets();
  const bucketSet = new Set(buckets.map((b) => monthKey(b.year, b.month)));

  const saleBase: Prisma.SaleWhereInput = {
    vehicleNumber: { not: "BPO-OUTBOUND" },
    ...(salesPointId != null ? { salesPointId } : {}),
    postingCalendarYear: { not: null },
    financialMonth: { not: null },
  };
  const saleWhere = mergeScopeWhere(saleBase, saleWhereForScope(scope));

  const sales = await prisma.sale.findMany({
    where: saleWhere,
    select: {
      grossAmount: true,
      postingCalendarYear: true,
      financialMonth: true,
    },
  });

  const totals = new Map<string, number>();
  for (const s of sales) {
    const y = s.postingCalendarYear;
    const m = s.financialMonth;
    if (y == null || m == null) continue;
    const key = monthKey(y, m);
    if (!bucketSet.has(key)) continue;
    const prev = totals.get(key) ?? 0;
    totals.set(key, prev + (Number.parseFloat(String(s.grossAmount)) || 0));
  }

  return buckets.map((b) => ({
    label: b.label,
    value: totals.get(monthKey(b.year, b.month)) ?? 0,
  }));
}

export async function getDeliveryOrderTrendByMonth(
  scope: ServiceScope,
  salesPointId?: number | null,
): Promise<TrendPoint[]> {
  const prisma = getPrismaClient();
  const buckets = last12MonthBuckets();
  const bucketSet = new Set(buckets.map((b) => monthKey(b.year, b.month)));

  const doBase: Prisma.DeliveryOrderWhereInput = {
    ...(salesPointId != null ? { salesPointId } : {}),
    postingCalendarYear: { not: null },
    financialMonth: { not: null },
  };
  const doWhere = mergeScopeWhere(doBase, deliveryOrderWhereForScope(scope));

  const orders = await prisma.deliveryOrder.findMany({
    where: doWhere,
    select: {
      postingCalendarYear: true,
      financialMonth: true,
    },
  });

  const totals = new Map<string, number>();
  for (const o of orders) {
    const y = o.postingCalendarYear;
    const m = o.financialMonth;
    if (y == null || m == null) continue;
    const key = monthKey(y, m);
    if (!bucketSet.has(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  return buckets.map((b) => ({
    label: b.label,
    value: totals.get(monthKey(b.year, b.month)) ?? 0,
  }));
}

export async function getSalesStatusBreakdown(
  scope: ServiceScope,
  monthFilter: ReportMonthFilter | null,
  salesPointId?: number | null,
): Promise<StatusSlice[]> {
  const prisma = getPrismaClient();
  const saleBase: Prisma.SaleWhereInput = {
    vehicleNumber: { not: "BPO-OUTBOUND" },
    ...(salesPointId != null ? { salesPointId } : {}),
    ...monthFilterWhere(monthFilter),
  };
  const saleWhere = mergeScopeWhere(saleBase, saleWhereForScope(scope));

  const [pending, validated, rejected] = await Promise.all([
    prisma.sale.count({ where: { ...saleWhere, status: ValidationStatus.PENDING } }),
    prisma.sale.count({ where: { ...saleWhere, status: ValidationStatus.VALIDATED } }),
    prisma.sale.count({ where: { ...saleWhere, status: ValidationStatus.REJECTED } }),
  ]);

  return [
    { name: "Validated", value: validated },
    { name: "Pending", value: pending },
    { name: "Rejected", value: rejected },
  ].filter((s) => s.value > 0);
}

export async function getDeliveryOrderStatusBreakdown(
  scope: ServiceScope,
  monthFilter: ReportMonthFilter | null,
  salesPointId?: number | null,
): Promise<StatusSlice[]> {
  const prisma = getPrismaClient();
  const doBase: Prisma.DeliveryOrderWhereInput = {
    ...(salesPointId != null ? { salesPointId } : {}),
    ...monthFilterWhere(monthFilter),
  };
  const doWhere = mergeScopeWhere(doBase, deliveryOrderWhereForScope(scope));

  const [pending, validated, cancelled] = await Promise.all([
    prisma.deliveryOrder.count({
      where: { ...doWhere, status: ValidationStatus.PENDING, cancelledAt: null },
    }),
    prisma.deliveryOrder.count({
      where: { ...doWhere, status: ValidationStatus.VALIDATED, cancelledAt: null },
    }),
    prisma.deliveryOrder.count({
      where: { ...doWhere, cancelledAt: { not: null } },
    }),
  ]);

  return [
    { name: "Validated", value: validated },
    { name: "Pending", value: pending },
    { name: "Cancelled", value: cancelled },
  ].filter((s) => s.value > 0);
}

export async function getLineSalesShare(
  monthFilter: ReportMonthFilter | null,
): Promise<StatusSlice[]> {
  const prisma = getPrismaClient();
  const services = await prisma.commercialService.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });

  const monthWhere = monthFilterWhere(monthFilter);
  const counts = await Promise.all(
    services.map(async (s) => ({
      name: s.name,
      value: await prisma.sale.count({
        where: {
          commercialServiceId: s.id,
          vehicleNumber: { not: "BPO-OUTBOUND" },
          ...monthWhere,
        },
      }),
    })),
  );

  return counts.filter((c) => c.value > 0);
}

export async function getStockKpis(
  scopedSalesPointId: number | null,
  scopeHint: string,
): Promise<StockKpis> {
  const prisma = getPrismaClient();

  const receiptWhere = {
    status: StockDocStatus.DRAFT,
    ...(scopedSalesPointId != null ? { salesPointId: scopedSalesPointId } : {}),
  };
  const incomingTransferWhere = {
    status: StockDocStatus.DISPATCHED,
    ...(scopedSalesPointId != null ? { toSalesPointId: scopedSalesPointId } : {}),
  };
  const outboundDraftTransferWhere = {
    status: StockDocStatus.DRAFT,
    ...(scopedSalesPointId != null ? { fromSalesPointId: scopedSalesPointId } : {}),
  };

  const [pendingReceiptCount, incomingTransferCount, outboundDraftTransferCount] =
    await Promise.all([
      prisma.stockReceipt.count({ where: receiptWhere }),
      prisma.stockTransfer.count({ where: incomingTransferWhere }),
      prisma.stockTransfer.count({ where: outboundDraftTransferWhere }),
    ]);

  return {
    pendingReceiptCount,
    incomingTransferCount,
    outboundDraftTransferCount,
    pendingTransferCount: incomingTransferCount + outboundDraftTransferCount,
    scopeHint,
  };
}

export async function getIncomingTransfers(
  scopedSalesPointId: number | null,
): Promise<IncomingTransferRow[]> {
  const prisma = getPrismaClient();
  const transfers = await prisma.stockTransfer.findMany({
    where: {
      status: StockDocStatus.DISPATCHED,
      ...(scopedSalesPointId != null ? { toSalesPointId: scopedSalesPointId } : {}),
    },
    orderBy: [{ dispatchedAt: "desc" }, { createdAt: "desc" }],
    take: 10,
    select: {
      id: true,
      transferNo: true,
      dispatchedAt: true,
      createdAt: true,
      fromSalesPoint: { select: { name: true } },
      toSalesPoint: { select: { name: true } },
      lines: { select: { qty: true } },
    },
  });

  return transfers.map((t) => ({
    id: t.id,
    transferNo: t.transferNo,
    fromName: t.fromSalesPoint.name,
    toName: t.toSalesPoint.name,
    dispatchedIso: (t.dispatchedAt ?? t.createdAt).toISOString().slice(0, 10),
    lineCount: t.lines.length,
  }));
}

export async function getTransferTrendByMonth(
  scopedSalesPointId: number | null,
): Promise<TrendPoint[]> {
  const prisma = getPrismaClient();
  const buckets = last12MonthBuckets();
  const since = new Date(
    Date.UTC(buckets[0]!.year, buckets[0]!.month - 1, 1),
  );

  const transfers = await prisma.stockTransfer.findMany({
    where: {
      createdAt: { gte: since },
      ...(scopedSalesPointId != null
        ? {
            OR: [
              { fromSalesPointId: scopedSalesPointId },
              { toSalesPointId: scopedSalesPointId },
            ],
          }
        : {}),
    },
    select: { createdAt: true },
  });

  const totals = new Map<string, number>();
  for (const t of transfers) {
    const d = t.createdAt;
    const key = monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  return buckets.map((b) => ({
    label: b.label,
    value: totals.get(monthKey(b.year, b.month)) ?? 0,
  }));
}

export async function getTransferStatusBreakdown(
  scopedSalesPointId: number | null,
): Promise<StatusSlice[]> {
  const prisma = getPrismaClient();
  const base =
    scopedSalesPointId != null
      ? {
          OR: [
            { fromSalesPointId: scopedSalesPointId },
            { toSalesPointId: scopedSalesPointId },
          ],
        }
      : {};

  const [draft, dispatched, received] = await Promise.all([
    prisma.stockTransfer.count({
      where: { ...base, status: StockDocStatus.DRAFT },
    }),
    prisma.stockTransfer.count({
      where: { ...base, status: StockDocStatus.DISPATCHED },
    }),
    prisma.stockTransfer.count({
      where: { ...base, status: StockDocStatus.RECEIVED },
    }),
  ]);

  return [
    { name: "Draft", value: draft },
    { name: "In transit", value: dispatched },
    { name: "Received", value: received },
  ].filter((s) => s.value > 0);
}
