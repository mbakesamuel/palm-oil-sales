import "server-only";

import { Prisma, StockCondition, ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";

const z = new Prisma.Decimal(0);

export const STOCK_VS_COMMITMENTS_CONDITIONS = [
  "all",
  "SELLABLE",
  "UNSELLABLE",
] as const;
export type StockVsCommitmentsConditionFilter =
  (typeof STOCK_VS_COMMITMENTS_CONDITIONS)[number];

export const STOCK_VS_COMMITMENTS_CONDITION_LABELS: Record<
  StockVsCommitmentsConditionFilter,
  string
> = {
  all: "All (sellable + unsellable)",
  SELLABLE: "Sellable only",
  UNSELLABLE: "Unsellable only",
};

export type StockVsCommitmentsFilterOption = { value: string; label: string };

export type StockVsCommitmentsStockRow = {
  salesPointId: number;
  salesPointName: string;
  storageLocationId: number;
  storageLocationName: string;
  productId: number;
  productName: string;
  condition: StockCondition;
  qtyKg: Prisma.Decimal;
};

export type StockVsCommitmentsCommitmentRow = {
  salesPointId: number;
  salesPointName: string;
  customerId: string;
  customerName: string;
  productId: number;
  productName: string;
  qtyKg: Prisma.Decimal;
};

export type StockVsCommitmentsLocationSummary = {
  salesPointId: number;
  salesPointName: string;
  storageLocationId: number;
  storageLocationName: string;
  qtyKg: Prisma.Decimal;
  lineCount: number;
};

export type StockVsCommitmentsCustomerSummary = {
  salesPointId: number;
  salesPointName: string;
  customerId: string;
  customerName: string;
  qtyKg: Prisma.Decimal;
  lineCount: number;
};

export type StockVsCommitmentsReportData = {
  settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
  scopedToSalesPoint: boolean;
  assignedSalesPointId: number | null;
  assignedSalesPointName: string | null;
  productOptions: StockVsCommitmentsFilterOption[];
  salesPointOptions: StockVsCommitmentsFilterOption[];
  selectedProductId: string;
  selectedSalesPointId: string;
  selectedCondition: StockVsCommitmentsConditionFilter;
  productInvalid: boolean;
  salesPointInvalid: boolean;
  scopeLabel: string;
  overallStockKg: Prisma.Decimal;
  overallCommitmentKg: Prisma.Decimal;
  uncommittedKg: Prisma.Decimal;
  commitmentOrderCount: number;
  stockByLocation: StockVsCommitmentsLocationSummary[];
  commitmentByCustomer: StockVsCommitmentsCustomerSummary[];
  stockRowCount: number;
  commitmentRowCount: number;
};

function dec(v: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal {
  if (v == null) return z;
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
}

function parseOptionalId(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseCondition(raw: string | undefined): StockVsCommitmentsConditionFilter {
  if (raw === "SELLABLE" || raw === "UNSELLABLE") return raw;
  return "all";
}

export async function loadStockVsCommitmentsReport(
  session: AuthSession,
  searchParams?: {
    productId?: string;
    salesPointId?: string;
    condition?: string;
  },
): Promise<StockVsCommitmentsReportData | { type: "no-sales-point" }> {
  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return { type: "no-sales-point" };
  }

  const selectedProductId = searchParams?.productId?.trim() ?? "";
  const selectedSalesPointId = searchParams?.salesPointId?.trim() ?? "";
  const selectedCondition = parseCondition(searchParams?.condition);
  const filterProductId = parseOptionalId(selectedProductId);
  const filterSalesPointId = scopedToSalesPoint
    ? null
    : parseOptionalId(selectedSalesPointId);

  const effectiveSalesPointId =
    scopedToSalesPoint && assignedSalesPointId != null
      ? assignedSalesPointId
      : filterSalesPointId;

  const [settings, prisma] = await Promise.all([
    getOrInitCompanySettings(),
    getPrismaClient(),
  ]);

  const stockWhere: Prisma.StockBalanceWhereInput = {
    qty: { gt: z },
    product: { uom: "Kg" },
    condition: {
      in:
        selectedCondition === "all"
          ? [StockCondition.SELLABLE, StockCondition.UNSELLABLE]
          : selectedCondition === "SELLABLE"
            ? [StockCondition.SELLABLE]
            : [StockCondition.UNSELLABLE],
    },
    ...(effectiveSalesPointId != null
      ? { salesPointId: effectiveSalesPointId }
      : {}),
    ...(filterProductId != null ? { productId: filterProductId } : {}),
  };

  const doWhere: Prisma.DeliveryOrderWhereInput = {
    status: ValidationStatus.VALIDATED,
    ...(effectiveSalesPointId != null
      ? { salesPointId: effectiveSalesPointId }
      : {}),
  };

  const [stockBalances, allSalesPoints, orders, kgProducts] = await Promise.all([
    prismaRetry(() =>
      prisma.stockBalance.findMany({
        where: stockWhere,
        select: {
          salesPointId: true,
          storageLocationId: true,
          productId: true,
          condition: true,
          qty: true,
          storageLocation: { select: { name: true, salesPointId: true } },
          product: { select: { productName: true } },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        where:
          scopedToSalesPoint && assignedSalesPointId != null
            ? { id: assignedSalesPointId }
            : {},
        select: { id: true, name: true },
        orderBy: { name: "asc" },
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
              product: { select: { productName: true, uom: true } },
            },
          },
        },
      }),
    ),
    prismaRetry(() =>
      prisma.product.findMany({
        where: { uom: "Kg" },
        select: { productId: true, productName: true },
        orderBy: { productName: "asc" },
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
              ...(effectiveSalesPointId != null
                ? { salesPointId: effectiveSalesPointId }
                : {}),
            },
            select: {
              deliveryOrderNo: true,
              lines: { select: { productId: true, qtyKg: true } },
            },
          }),
        )
      : [];

  const spName = new Map<number, string>(allSalesPoints.map((s) => [s.id, s.name]));
  const validProductIds = new Set(kgProducts.map((p) => p.productId));
  const validSalesPointIds = new Set(allSalesPoints.map((s) => s.id));
  const productInvalid =
    filterProductId != null && !validProductIds.has(filterProductId);
  const salesPointInvalid =
    !scopedToSalesPoint &&
    filterSalesPointId != null &&
    !validSalesPointIds.has(filterSalesPointId);

  const productOptions: StockVsCommitmentsFilterOption[] = kgProducts.map((p) => ({
    value: String(p.productId),
    label: p.productName,
  }));

  const salesPointOptions: StockVsCommitmentsFilterOption[] = allSalesPoints.map(
    (s) => ({
      value: String(s.id),
      label: s.name,
    }),
  );

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

  const stockRows: StockVsCommitmentsStockRow[] = [];
  for (const b of stockBalances) {
    if (productInvalid || salesPointInvalid) continue;
    if (b.storageLocation.salesPointId !== b.salesPointId) continue;
    stockRows.push({
      salesPointId: b.salesPointId,
      salesPointName: spName.get(b.salesPointId) ?? `Sales point ${b.salesPointId}`,
      storageLocationId: b.storageLocationId,
      storageLocationName: b.storageLocation.name,
      productId: b.productId,
      productName: b.product.productName,
      condition: b.condition,
      qtyKg: dec(b.qty),
    });
  }

  const commitmentRows: StockVsCommitmentsCommitmentRow[] = [];
  const ordersWithCommitments = new Set<string>();

  if (!productInvalid && !salesPointInvalid) {
    for (const o of orders) {
      const orderedByProduct = new Map<
        number,
        { orderQty: number; productName: string }
      >();
      for (const d of o.details) {
        if (d.product.uom !== "Kg") continue;
        if (filterProductId != null && d.productId !== filterProductId) continue;
        const ex = orderedByProduct.get(d.productId);
        if (ex) ex.orderQty += d.orderQty;
        else
          orderedByProduct.set(d.productId, {
            orderQty: d.orderQty,
            productName: d.product.productName,
          });
      }
      for (const [productId, { orderQty, productName }] of orderedByProduct) {
        const orderedQty = new Prisma.Decimal(orderQty);
        const invoiced =
          invoicedQtyByDoNoProduct.get(`${o.deliveryOrderNo}:${productId}`) ?? z;
        const balance = orderedQty.sub(invoiced);
        if (balance.eq(z)) continue;
        ordersWithCommitments.add(o.deliveryOrderNo);
        commitmentRows.push({
          salesPointId: o.salesPointId,
          salesPointName:
            spName.get(o.salesPointId) ?? `Sales point ${o.salesPointId}`,
          customerId: o.customerId,
          customerName: o.customer.name,
          productId,
          productName,
          qtyKg: balance,
        });
      }
    }
  }

  let overallStockKg = z;
  for (const r of stockRows) {
    overallStockKg = overallStockKg.add(r.qtyKg);
  }

  let overallCommitmentKg = z;
  for (const r of commitmentRows) {
    overallCommitmentKg = overallCommitmentKg.add(r.qtyKg);
  }

  const uncommittedKg = overallStockKg.sub(overallCommitmentKg);

  const stockByLocation = buildLocationSummaries(stockRows);
  const commitmentByCustomer = buildCustomerSummaries(commitmentRows);

  let scopeLabel: string;
  if (scopedToSalesPoint && assignedSalesPointName) {
    scopeLabel = assignedSalesPointName;
  } else if (effectiveSalesPointId != null) {
    scopeLabel =
      spName.get(effectiveSalesPointId) ?? `Sales point ${effectiveSalesPointId}`;
  } else {
    scopeLabel = "All sales points";
  }

  return {
    settings,
    scopedToSalesPoint,
    assignedSalesPointId,
    assignedSalesPointName,
    productOptions,
    salesPointOptions,
    selectedProductId,
    selectedSalesPointId,
    selectedCondition,
    productInvalid,
    salesPointInvalid,
    scopeLabel,
    overallStockKg,
    overallCommitmentKg,
    uncommittedKg,
    commitmentOrderCount: ordersWithCommitments.size,
    stockByLocation,
    commitmentByCustomer,
    stockRowCount: stockRows.length,
    commitmentRowCount: commitmentRows.length,
  };
}

function buildLocationSummaries(
  rows: StockVsCommitmentsStockRow[],
): StockVsCommitmentsLocationSummary[] {
  const byKey = new Map<
    string,
    {
      salesPointId: number;
      salesPointName: string;
      storageLocationId: number;
      storageLocationName: string;
      qtyKg: Prisma.Decimal;
      lineCount: number;
    }
  >();

  for (const r of rows) {
    const key = `${r.salesPointId}:${r.storageLocationId}`;
    const ex = byKey.get(key);
    if (!ex) {
      byKey.set(key, {
        salesPointId: r.salesPointId,
        salesPointName: r.salesPointName,
        storageLocationId: r.storageLocationId,
        storageLocationName: r.storageLocationName,
        qtyKg: dec(r.qtyKg),
        lineCount: 1,
      });
      continue;
    }
    ex.qtyKg = ex.qtyKg.add(r.qtyKg);
    ex.lineCount += 1;
  }

  return [...byKey.values()].sort((a, b) => {
    const bySp = a.salesPointName.localeCompare(b.salesPointName, undefined, {
      sensitivity: "base",
    });
    if (bySp !== 0) return bySp;
    return a.storageLocationName.localeCompare(b.storageLocationName, undefined, {
      sensitivity: "base",
    });
  });
}

function buildCustomerSummaries(
  rows: StockVsCommitmentsCommitmentRow[],
): StockVsCommitmentsCustomerSummary[] {
  const byKey = new Map<
    string,
    {
      salesPointId: number;
      salesPointName: string;
      customerId: string;
      customerName: string;
      qtyKg: Prisma.Decimal;
      lineCount: number;
    }
  >();

  for (const r of rows) {
    const key = `${r.salesPointId}:${r.customerId}`;
    const ex = byKey.get(key);
    if (!ex) {
      byKey.set(key, {
        salesPointId: r.salesPointId,
        salesPointName: r.salesPointName,
        customerId: r.customerId,
        customerName: r.customerName,
        qtyKg: dec(r.qtyKg),
        lineCount: 1,
      });
      continue;
    }
    ex.qtyKg = ex.qtyKg.add(r.qtyKg);
    ex.lineCount += 1;
  }

  return [...byKey.values()].sort((a, b) => {
    const bySp = a.salesPointName.localeCompare(b.salesPointName, undefined, {
      sensitivity: "base",
    });
    if (bySp !== 0) return bySp;
    return a.customerName.localeCompare(b.customerName, undefined, {
      sensitivity: "base",
    });
  });
}

export function fmtKgQty(d: Prisma.Decimal): string {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n)} Kg`;
}
