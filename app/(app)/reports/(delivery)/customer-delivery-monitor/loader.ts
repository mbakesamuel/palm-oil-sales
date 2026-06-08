import { Prisma, ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import { customerWhereForOperationalUI } from "@/lib/customers/operational-customer-scope";
import {
  deliveryOrderWhereForScope,
  resolveServiceScope,
} from "@/lib/service-scope";

const z = new Prisma.Decimal(0);

export function xafCdm(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

export function fmtKgCdm(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

export function invoicedKgByProductFromSales(
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

export function describeFulfillment(
  doStatus: ValidationStatus,
  details: Array<{ productId: number; orderQty: number }>,
  invoicedKgByProduct: Map<number, Prisma.Decimal>,
): { label: string; kind: "pending" | "complete" | "partial" | "over" } {
  if (doStatus === ValidationStatus.PENDING) {
    return { label: "Pending validation", kind: "pending" };
  }
  let over = false;
  let partial = false;
  for (const d of details) {
    const inv = invoicedKgByProduct.get(d.productId) ?? z;
    const ordered = new Prisma.Decimal(d.orderQty);
    if (inv.gt(ordered)) over = true;
    else if (inv.lt(ordered)) partial = true;
  }
  if (over) return { label: "Over-invoiced (check quantities)", kind: "over" };
  if (partial)
    return { label: "Incomplete (partial invoicing)", kind: "partial" };
  return { label: "Complete", kind: "complete" };
}

export type CdmOrderRow = {
  id: number;
  deliveryOrderNo: string;
  dateIssued: Date;
  salesPointName: string;
  status: ValidationStatus;
  doTotalQty: number;
  doTotalAmount: Prisma.Decimal;
  saleCount: number;
  validatedSaleCount: number;
  invoicedGross: Prisma.Decimal;
  balanceAmount: Prisma.Decimal;
  fulfillmentLabel: string;
  fulfillmentKind: "pending" | "complete" | "partial" | "over";
};

async function loadOrdersAndSales(
  customerId: string,
  doScopeWhere: Prisma.DeliveryOrderWhereInput,
  scopedToSalesPoint: boolean,
  assignedSalesPointId: number | null,
) {
  const prisma = getPrismaClient();
  const orders = await prismaRetry(() =>
    prisma.deliveryOrder.findMany({
      where: {
        customerId,
        ...doScopeWhere,
      },
      orderBy: [{ dateIssued: "desc" }, { id: "desc" }],
      include: {
        salesPoint: { select: { id: true, name: true } },
        details: {
          orderBy: { id: "asc" },
          include: {
            product: {
              select: {
                productId: true,
                productName: true,
                productCode: true,
              },
            },
          },
        },
      },
    }),
  );

  const deliveryOrderNos = orders.map((o) => o.deliveryOrderNo);
  const allSales =
    deliveryOrderNos.length > 0
      ? await prismaRetry(() =>
          prisma.sale.findMany({
            where: {
              deliveryOrderNo: { in: deliveryOrderNos },
              ...(scopedToSalesPoint && assignedSalesPointId != null
                ? { salesPointId: assignedSalesPointId }
                : {}),
            },
            orderBy: [{ soldAt: "asc" }, { id: "asc" }],
            include: {
              salesPoint: { select: { name: true } },
              lines: {
                orderBy: { id: "asc" },
                include: { product: { select: { productName: true } } },
              },
              createdBy: { select: { name: true } },
            },
          }),
        )
      : [];

  return { orders, allSales };
}

export type CustomerDeliveryMonitorData = {
  settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
  scopedToSalesPoint: boolean;
  assignedSalesPointName: string | null;
  customerOptions: Array<{ id: string; name: string }>;
  selectedCustomerId: string;
  customerInvalid: boolean;
  customerRow: { id: string; name: string; phone: string | null } | null;
  orders: Awaited<ReturnType<typeof loadOrdersAndSales>>["orders"];
  allSales: Awaited<ReturnType<typeof loadOrdersAndSales>>["allSales"];
  salesByDoNo: Map<
    string,
    Awaited<ReturnType<typeof loadOrdersAndSales>>["allSales"]
  >;
  summaryRows: CdmOrderRow[];
  grandDoAmount: Prisma.Decimal;
  grandInvoiced: Prisma.Decimal;
  grandBalance: Prisma.Decimal;
  grandDoQty: number;
};

export async function loadCustomerDeliveryMonitor(
  session: AuthSession,
  requestedCustomerIdRaw: string | null | undefined,
): Promise<CustomerDeliveryMonitorData | { type: "no-sales-point" }> {
  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;
  const serviceScope = resolveServiceScope(session);

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return { type: "no-sales-point" };
  }

  const requestedCustomerId = String(requestedCustomerIdRaw ?? "").trim();
  const [settings, prisma] = await Promise.all([
    getOrInitCompanySettings(),
    getPrismaClient(),
  ]);

  const doServiceWhere = deliveryOrderWhereForScope(serviceScope);
  const doScopeWhere: Prisma.DeliveryOrderWhereInput = {
    ...(scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {}),
    ...(doServiceWhere ?? {}),
  };

  const customerScopeWhere = customerWhereForOperationalUI(serviceScope);

  const customerIdsWithScopedOrders = await prismaRetry(() =>
    prisma.deliveryOrder.findMany({
      where: doScopeWhere,
      distinct: ["customerId"],
      select: { customerId: true },
    }),
  );
  const allowedCustomerIds = new Set(
    customerIdsWithScopedOrders.map((r) => r.customerId),
  );

  const customerOptions = scopedToSalesPoint
    ? await prismaRetry(() =>
        prisma.customer.findMany({
          where: {
            AND: [{ id: { in: [...allowedCustomerIds] } }, customerScopeWhere],
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      )
    : await prismaRetry(() =>
        prisma.customer.findMany({
          where: customerScopeWhere,
          orderBy: { name: "asc" },
          take: 500,
          select: { id: true, name: true },
        }),
      );

  let selectedCustomerId = "";
  let customerInvalid = false;
  if (requestedCustomerId) {
    if (scopedToSalesPoint) {
      if (allowedCustomerIds.has(requestedCustomerId)) {
        selectedCustomerId = requestedCustomerId;
      } else {
        customerInvalid = true;
      }
    } else {
      const exists = await prismaRetry(() =>
        prisma.customer.findFirst({
          where: { id: requestedCustomerId, ...customerScopeWhere },
          select: { id: true },
        }),
      );
      if (exists) {
        selectedCustomerId = requestedCustomerId;
      } else {
        customerInvalid = true;
      }
    }
  }

  const customerRow = selectedCustomerId
    ? ((await prismaRetry(() =>
        prisma.customer.findUnique({
          where: { id: selectedCustomerId },
          select: { id: true, name: true, phone: true },
        }),
      )) ?? null)
    : null;

  const { orders, allSales } =
    selectedCustomerId && customerRow
      ? await loadOrdersAndSales(
          selectedCustomerId,
          doScopeWhere,
          scopedToSalesPoint,
          assignedSalesPointId,
        )
      : { orders: [], allSales: [] };

  const salesByDoNo = new Map<string, typeof allSales>();
  for (const s of allSales) {
    const k = s.deliveryOrderNo ?? "";
    if (!k) continue;
    const arr = salesByDoNo.get(k) ?? [];
    arr.push(s);
    salesByDoNo.set(k, arr);
  }

  const summaryRowsAll: CdmOrderRow[] = orders.map((o) => {
    const salesForDo = salesByDoNo.get(o.deliveryOrderNo) ?? [];
    const validated = salesForDo.filter(
      (s) => s.status === ValidationStatus.VALIDATED,
    );
    const invoicedGross = validated.reduce(
      (acc, s) => acc.add(s.grossAmount),
      z,
    );
    const doTotalAmount = o.details.reduce(
      (acc, d) => acc.add(d.amount ?? z),
      z,
    );
    const doTotalQty = o.details.reduce((acc, d) => acc + d.orderQty, 0);
    const invMap = invoicedKgByProductFromSales(validated);
    const { label, kind } = describeFulfillment(o.status, o.details, invMap);
    return {
      id: o.id,
      deliveryOrderNo: o.deliveryOrderNo,
      dateIssued: o.dateIssued,
      salesPointName: o.salesPoint.name,
      status: o.status,
      doTotalQty,
      doTotalAmount,
      saleCount: salesForDo.length,
      validatedSaleCount: validated.length,
      invoicedGross,
      balanceAmount: doTotalAmount.sub(invoicedGross),
      fulfillmentLabel: label,
      fulfillmentKind: kind,
    };
  });
  // Commitments: exclude DOs that are fully satisfied (0 remaining balance across lines).
  const summaryRows = summaryRowsAll.filter((r) => r.fulfillmentKind !== "complete");

  const grandDoAmount = summaryRows.reduce(
    (acc, r) => acc.add(r.doTotalAmount),
    z,
  );
  const grandInvoiced = summaryRows.reduce(
    (acc, r) => acc.add(r.invoicedGross),
    z,
  );
  const grandBalance = grandDoAmount.sub(grandInvoiced);
  const grandDoQty = summaryRows.reduce((acc, r) => acc + r.doTotalQty, 0);

  return {
    settings,
    scopedToSalesPoint,
    assignedSalesPointName,
    customerOptions,
    selectedCustomerId,
    customerInvalid,
    customerRow,
    orders,
    allSales,
    salesByDoNo,
    summaryRows,
    grandDoAmount,
    grandInvoiced,
    grandBalance,
    grandDoQty,
  };
}
