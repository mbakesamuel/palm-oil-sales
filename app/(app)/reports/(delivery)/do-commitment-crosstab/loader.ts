import { Prisma, ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";

const z = new Prisma.Decimal(0);

export function fmtQtyCx(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

export type DoCommitmentCellKey = `${string}:${number}:${number}`;
export type DoCommitmentRowKey = `${string}:${number}`;

export type DoCommitmentProductSection = {
  productId: number;
  productName: string;
  customerIds: string[];
  customerNameById: Map<string, string>;
  cellBalance: Map<DoCommitmentCellKey, Prisma.Decimal>;
  rowTotals: Map<string, Prisma.Decimal>;
  colTotals: Map<number, Prisma.Decimal>;
  total: Prisma.Decimal;
};

export type DoCommitmentReportData = {
  settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
  scopedToSalesPoint: boolean;
  assignedSalesPointName: string | null;
  ordersCount: number;
  salesPoints: Array<{ id: number; name: string }>;
  products: DoCommitmentProductSection[];
  grandTotal: Prisma.Decimal;
};

export async function loadDoCommitmentCrosstab(
  session: AuthSession,
): Promise<DoCommitmentReportData | { type: "no-sales-point" }> {
  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return { type: "no-sales-point" };
  }

  const [settings, prisma] = await Promise.all([
    getOrInitCompanySettings(),
    getPrismaClient(),
  ]);

  const doWhere: Prisma.DeliveryOrderWhereInput = {
    status: ValidationStatus.VALIDATED,
    ...(scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {}),
  };

  const [salesPoints, orders] = await Promise.all([
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
      prisma.deliveryOrder.findMany({
        where: doWhere,
        select: {
          deliveryOrderNo: true,
          customerId: true,
          salesPointId: true,
          customer: { select: { id: true, name: true } },
          details: {
            select: {
              orderQty: true,
              productId: true,
              product: { select: { productName: true } },
            },
          },
        },
      }),
    ),
  ]);

  const deliveryOrderNos = [...new Set(orders.map((o) => o.deliveryOrderNo))];
  const sales =
    deliveryOrderNos.length > 0
      ? await prismaRetry(() =>
          prisma.sale.findMany({
            where: {
              deliveryOrderNo: { in: deliveryOrderNos },
              status: ValidationStatus.VALIDATED,
              ...(scopedToSalesPoint && assignedSalesPointId != null
                ? { salesPointId: assignedSalesPointId }
                : {}),
            },
            select: {
              deliveryOrderNo: true,
              lines: { select: { productId: true, qtyKg: true } },
            },
          }),
        )
      : [];

  const invoicedQtyByDoNoProduct = new Map<string, Prisma.Decimal>();
  for (const s of sales) {
    const no = s.deliveryOrderNo ?? "";
    if (!no) continue;
    for (const l of s.lines) {
      const k = `${no}:${l.productId}`;
      invoicedQtyByDoNoProduct.set(
        k,
        (invoicedQtyByDoNoProduct.get(k) ?? z).add(l.qtyKg),
      );
    }
  }

  const cellBalance = new Map<DoCommitmentCellKey, Prisma.Decimal>();
  const customerNameById = new Map<string, string>();
  const productNameById = new Map<number, string>();
  const ordersWithCommitments = new Set<string>();

  for (const o of orders) {
    const customerName = o.customer.name;
    customerNameById.set(o.customerId, customerName);
    const orderedByProduct = new Map<
      number,
      { orderQty: number; productName: string }
    >();
    for (const d of o.details) {
      const ex = orderedByProduct.get(d.productId);
      if (ex) ex.orderQty += d.orderQty;
      else
        orderedByProduct.set(d.productId, {
          orderQty: d.orderQty,
          productName: d.product.productName,
        });
    }
    for (const [productId, { orderQty, productName }] of orderedByProduct) {
      productNameById.set(productId, productName);
      const orderedQty = new Prisma.Decimal(orderQty);
      const invoiced =
        invoicedQtyByDoNoProduct.get(`${o.deliveryOrderNo}:${productId}`) ?? z;
      const balance = orderedQty.sub(invoiced);
      // A balance of exactly 0 means "no commitment" for that DO+product.
      // Keep negative balances (over-invoiced) so users can spot issues.
      if (balance.eq(z)) continue;
      ordersWithCommitments.add(o.deliveryOrderNo);
      const ck: DoCommitmentCellKey = `${o.customerId}:${productId}:${o.salesPointId}`;
      cellBalance.set(ck, (cellBalance.get(ck) ?? z).add(balance));
    }
  }

  const customerIds = [...customerNameById.keys()].sort((a, b) =>
    (customerNameById.get(a) ?? a).localeCompare(customerNameById.get(b) ?? b, undefined, {
      sensitivity: "base",
    }),
  );

  const productIds = [...productNameById.keys()].sort((a, b) =>
    (productNameById.get(a) ?? String(a)).localeCompare(productNameById.get(b) ?? String(b), undefined, {
      sensitivity: "base",
    }),
  );

  const products: DoCommitmentProductSection[] = [];
  let grandTotal = z;

  for (const productId of productIds) {
    const rowTotals = new Map<string, Prisma.Decimal>();
    const colTotals = new Map<number, Prisma.Decimal>();
    let total = z;

    for (const cid of customerIds) {
      let row = z;
      for (const sp of salesPoints) {
        row = row.add(cellBalance.get(`${cid}:${productId}:${sp.id}` as DoCommitmentCellKey) ?? z);
      }
      if (!row.eq(z)) rowTotals.set(cid, row);
    }

    for (const sp of salesPoints) {
      let col = z;
      for (const cid of customerIds) {
        col = col.add(cellBalance.get(`${cid}:${productId}:${sp.id}` as DoCommitmentCellKey) ?? z);
      }
      colTotals.set(sp.id, col);
      total = total.add(col);
    }

    if (total.eq(z)) continue;
    grandTotal = grandTotal.add(total);

    const sectionCustomerIds = [...rowTotals.keys()];
    products.push({
      productId,
      productName: productNameById.get(productId) ?? `Product ${productId}`,
      customerIds: sectionCustomerIds,
      customerNameById,
      cellBalance,
      rowTotals,
      colTotals,
      total,
    });
  }

  return {
    settings,
    scopedToSalesPoint,
    assignedSalesPointName,
    ordersCount: ordersWithCommitments.size,
    salesPoints,
    products,
    grandTotal,
  };
}
