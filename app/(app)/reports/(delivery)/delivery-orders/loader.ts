import { Prisma, ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";

export const DELIVERY_ORDERS_REPORT_LIMIT = 500;

const z = new Prisma.Decimal(0);

export type DeliveryOrderReportRow = {
  id: number;
  deliveryOrderNo: string;
  dateIssued: Date;
  orderRef: string | null;
  financialYear: number | null;
  financialMonth: number | null;
  postingCalendarYear: number | null;
  customer: { name: string };
  salesPoint: { id: number; name: string };
  lineCount: number;
  total: Prisma.Decimal;
};

export type DeliveryOrdersSummaryRow = {
  salesPointId: number;
  salesPointName: string;
  orderCount: number;
  lineCount: number;
  total: Prisma.Decimal;
};

export type DeliveryOrdersReportData = {
  settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
  scopedToSalesPoint: boolean;
  assignedSalesPointId: number | null;
  assignedSalesPointName: string | null;
  rows: DeliveryOrderReportRow[];
  totalLines: number;
  grand: Prisma.Decimal;
  summaryBySp: DeliveryOrdersSummaryRow[];
  summaryGrandOrders: number;
  summaryGrandLines: number;
  summaryGrandTotal: Prisma.Decimal;
};

export function xafDeliveryOrders(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

function buildSummaryBySalesPoint(
  rows: Array<{
    salesPoint: { id: number; name: string };
    lineCount: number;
    total: Prisma.Decimal;
  }>,
): DeliveryOrdersSummaryRow[] {
  const map = new Map<number, DeliveryOrdersSummaryRow>();
  for (const r of rows) {
    const id = r.salesPoint.id;
    const existing = map.get(id);
    if (existing) {
      existing.orderCount += 1;
      existing.lineCount += r.lineCount;
      existing.total = existing.total.add(r.total);
    } else {
      map.set(id, {
        salesPointId: id,
        salesPointName: r.salesPoint.name,
        orderCount: 1,
        lineCount: r.lineCount,
        total: r.total,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.salesPointName.localeCompare(b.salesPointName, undefined, {
      sensitivity: "base",
    }),
  );
}

export async function loadDeliveryOrdersReport(
  session: AuthSession,
): Promise<DeliveryOrdersReportData | { type: "no-sales-point" }> {
  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return { type: "no-sales-point" };
  }

  const [settings, prisma] = await Promise.all([
    getOrInitCompanySettings(),
    getPrismaClient(),
  ]);

  const where =
    scopedToSalesPoint && assignedSalesPointId != null
      ? {
          salesPointId: assignedSalesPointId,
          status: ValidationStatus.VALIDATED,
        }
      : undefined;

  const orders = await prismaRetry(() =>
    prisma.deliveryOrder.findMany({
      where,
      orderBy: { dateIssued: "desc" },
      take: DELIVERY_ORDERS_REPORT_LIMIT,
      select: {
        id: true,
        deliveryOrderNo: true,
        dateIssued: true,
        orderRef: true,
        financialYear: true,
        financialMonth: true,
        postingCalendarYear: true,
        customer: { select: { name: true } },
        salesPoint: { select: { id: true, name: true } },
        details: { select: { amount: true } },
      },
    }),
  );

  const rows: DeliveryOrderReportRow[] = orders.map((o) => {
    const total = o.details.reduce(
      (acc, d) => acc.add(d.amount ?? z),
      z,
    );
    return { ...o, lineCount: o.details.length, total };
  });

  const grand = rows.reduce((acc, r) => acc.add(r.total), z);
  const totalLines = rows.reduce((acc, r) => acc + r.lineCount, 0);
  const summaryBySp = !scopedToSalesPoint ? buildSummaryBySalesPoint(rows) : [];
  const summaryGrandOrders = summaryBySp.reduce(
    (acc, s) => acc + s.orderCount,
    0,
  );
  const summaryGrandLines = summaryBySp.reduce(
    (acc, s) => acc + s.lineCount,
    0,
  );
  const summaryGrandTotal = summaryBySp.reduce(
    (acc, s) => acc.add(s.total),
    z,
  );

  return {
    settings,
    scopedToSalesPoint,
    assignedSalesPointId,
    assignedSalesPointName,
    rows,
    totalLines,
    grand,
    summaryBySp,
    summaryGrandOrders,
    summaryGrandLines,
    summaryGrandTotal,
  };
}
