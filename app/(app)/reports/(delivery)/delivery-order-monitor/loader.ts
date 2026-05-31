import { Prisma, ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";

const z = new Prisma.Decimal(0);

export function xafDom(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

export function fmtKgDom(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

export type DeliveryOrderMonitorData = {
  settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
  scopedToSalesPoint: boolean;
  assignedSalesPointId: number | null;
  assignedSalesPointName: string | null;
  lookupNo: string;
  notFound: boolean;
  wrongScope: boolean;
  order: NonNullable<Awaited<ReturnType<typeof loadOrderRaw>>> | null;
  sales: Awaited<ReturnType<typeof loadSalesRaw>>;
  doTotalAmount: Prisma.Decimal;
  doTotalQty: number;
  invoicedGross: Prisma.Decimal;
  invoicedNet: Prisma.Decimal;
  invoicedQtyKg: Prisma.Decimal;
  balanceAmount: Prisma.Decimal;
  productRows: Array<{
    productId: number;
    productName: string;
    productCode: string | null;
    doQty: number;
    orderUnit: string;
    invoicedKg: Prisma.Decimal;
    qtyBalance: Prisma.Decimal;
  }>;
};

function loadOrderRaw(deliveryOrderNo: string) {
  const prisma = getPrismaClient();
  return prismaRetry(() =>
    prisma.deliveryOrder.findUnique({
      where: { deliveryOrderNo },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        salesPoint: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
        validatedBy: { select: { name: true } },
        details: {
          orderBy: { id: "asc" },
          include: {
            product: {
              select: { productId: true, productName: true, productCode: true },
            },
          },
        },
      },
    }),
  );
}

function loadSalesRaw(
  deliveryOrderNo: string,
  scopedToSalesPoint: boolean,
  assignedSalesPointId: number | null,
) {
  const prisma = getPrismaClient();
  return prismaRetry(() =>
    prisma.sale.findMany({
      where: {
        deliveryOrderNo,
        ...(scopedToSalesPoint && assignedSalesPointId != null
          ? { salesPointId: assignedSalesPointId }
          : {}),
      },
      orderBy: { soldAt: "asc" },
      include: {
        salesPoint: { select: { name: true } },
        lines: {
          orderBy: { id: "asc" },
          include: { product: { select: { productName: true } } },
        },
        createdBy: { select: { name: true } },
      },
    }),
  );
}

export async function loadDeliveryOrderMonitor(
  session: AuthSession,
  rawNo: string | null | undefined,
): Promise<DeliveryOrderMonitorData | { type: "no-sales-point" }> {
  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return { type: "no-sales-point" };
  }

  const lookupNo = String(rawNo ?? "").trim();
  const settings = await getOrInitCompanySettings();

  let notFound = false;
  let wrongScope = false;
  let order: Awaited<ReturnType<typeof loadOrderRaw>> = null;

  if (lookupNo) {
    order = await loadOrderRaw(lookupNo);
    if (!order) {
      notFound = true;
    } else if (
      scopedToSalesPoint &&
      order.salesPointId !== assignedSalesPointId
    ) {
      wrongScope = true;
      order = null;
    } else if (
      scopedToSalesPoint &&
      order.status !== ValidationStatus.VALIDATED
    ) {
      notFound = true;
      order = null;
    }
  }

  const sales =
    lookupNo && order && !wrongScope
      ? await loadSalesRaw(
          order.deliveryOrderNo,
          scopedToSalesPoint,
          assignedSalesPointId,
        )
      : [];

  const doTotalAmount = order
    ? order.details.reduce((acc, d) => acc.add(d.amount ?? z), z)
    : z;
  const doTotalQty = order
    ? order.details.reduce((acc, d) => acc + d.orderQty, 0)
    : 0;

  const validatedSales = sales.filter(
    (s) => s.status === ValidationStatus.VALIDATED,
  );
  const invoicedGross = validatedSales.reduce(
    (acc, s) => acc.add(s.grossAmount),
    z,
  );
  const invoicedNet = validatedSales.reduce(
    (acc, s) => acc.add(s.netAmount),
    z,
  );
  const invoicedQtyKg = validatedSales.reduce(
    (acc, s) => acc.add(s.lines.reduce((a, l) => a.add(l.qtyKg), z)),
    z,
  );

  const balanceAmount = doTotalAmount.sub(invoicedGross);

  const invoicedKgByProduct = new Map<number, Prisma.Decimal>();
  for (const s of validatedSales) {
    for (const l of s.lines) {
      const prev = invoicedKgByProduct.get(l.productId) ?? z;
      invoicedKgByProduct.set(l.productId, prev.add(l.qtyKg));
    }
  }

  const productRows =
    order?.details.map((d) => {
      const inv = invoicedKgByProduct.get(d.productId) ?? z;
      const balQty = new Prisma.Decimal(d.orderQty).sub(inv);
      return {
        productId: d.productId,
        productName: d.product.productName,
        productCode: d.product.productCode,
        doQty: d.orderQty,
        orderUnit: d.orderUnit ?? "—",
        invoicedKg: inv,
        qtyBalance: balQty,
      };
    }) ?? [];

  return {
    settings,
    scopedToSalesPoint,
    assignedSalesPointId,
    assignedSalesPointName,
    lookupNo,
    notFound,
    wrongScope,
    order,
    sales,
    doTotalAmount,
    doTotalQty,
    invoicedGross,
    invoicedNet,
    invoicedQtyKg,
    balanceAmount,
    productRows,
  };
}
