import "server-only";

import { Prisma, StockCondition } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";

const z = new Prisma.Decimal(0);

export type StockOnHandByLocationRow = {
  storageLocationId: number;
  storageLocationName: string;
  productId: number;
  productName: string;
  qtyKg: Prisma.Decimal;
  remark: "Sellable" | "Unsellable";
  sellableKg: Prisma.Decimal;
  unsellableKg: Prisma.Decimal;
};

export type StockOnHandBySalesPointSection = {
  salesPointId: number;
  salesPointName: string;
  rows: StockOnHandByLocationRow[];
  totalKg: Prisma.Decimal;
  sellableTotalKg: Prisma.Decimal;
  unsellableTotalKg: Prisma.Decimal;
};

export type StockOnHandReportData = {
  settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
  scopedToSalesPoint: boolean;
  assignedSalesPointId: number | null;
  assignedSalesPointName: string | null;
  sections: StockOnHandBySalesPointSection[];
  grandTotalKg: Prisma.Decimal;
  grandSellableKg: Prisma.Decimal;
  grandUnsellableKg: Prisma.Decimal;
};

function dec(v: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal {
  if (v == null) return z;
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
}

/**
 * Current stock on hand by sales point and storage location.
 *
 * Notes:
 * - One row per sales point, storage location, and product (kg-based products only).
 * - Aggregates sellable + unsellable qty per row; remark reflects condition mix.
 */
export async function loadStockOnHandReport(
  session: AuthSession,
): Promise<StockOnHandReportData | { type: "no-sales-point" }> {
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

  const whereSalesPoint =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {};

  const grouped = await prismaRetry(() =>
    prisma.stockBalance.groupBy({
      by: ["salesPointId", "storageLocationId", "productId", "condition"],
      where: {
        ...whereSalesPoint,
        qty: { gt: z },
        product: { uom: "Kg" },
        condition: { in: [StockCondition.SELLABLE, StockCondition.UNSELLABLE] },
      },
      _sum: { qty: true },
    }),
  );

  const salesPointIds = [...new Set(grouped.map((g) => g.salesPointId))];
  const locationIds = [...new Set(grouped.map((g) => g.storageLocationId))];
  const productIds = [...new Set(grouped.map((g) => g.productId))];

  const [salesPoints, locations, products] = await Promise.all([
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        where: { id: { in: salesPointIds.length > 0 ? salesPointIds : [-1] } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ),
    prismaRetry(() =>
      prisma.storageLocation.findMany({
        where: { id: { in: locationIds.length > 0 ? locationIds : [-1] } },
        select: { id: true, salesPointId: true, name: true },
        orderBy: [{ salesPointId: "asc" }, { name: "asc" }],
      }),
    ),
    prismaRetry(() =>
      prisma.product.findMany({
        where: { productId: { in: productIds.length > 0 ? productIds : [-1] } },
        select: { productId: true, productName: true },
        orderBy: { productName: "asc" },
      }),
    ),
  ]);

  const spName = new Map<number, string>(salesPoints.map((s) => [s.id, s.name]));
  const locName = new Map<number, { name: string; salesPointId: number }>(
    locations.map((l) => [l.id, { name: l.name, salesPointId: l.salesPointId }]),
  );
  const productName = new Map<number, string>(
    products.map((p) => [p.productId, p.productName]),
  );

  const qtyBySpLocProduct = new Map<
    string,
    { sellableKg: Prisma.Decimal; unsellableKg: Prisma.Decimal }
  >();
  for (const g of grouped) {
    const key = `${g.salesPointId}:${g.storageLocationId}:${g.productId}`;
    const ex = qtyBySpLocProduct.get(key) ?? { sellableKg: z, unsellableKg: z };
    const q = dec(g._sum.qty);
    if (g.condition === StockCondition.UNSELLABLE) {
      ex.unsellableKg = ex.unsellableKg.add(q);
    } else {
      ex.sellableKg = ex.sellableKg.add(q);
    }
    qtyBySpLocProduct.set(key, ex);
  }

  const rowsBySp = new Map<number, StockOnHandByLocationRow[]>();
  for (const [key, q] of qtyBySpLocProduct.entries()) {
    const [spIdStr, locIdStr, productIdStr] = key.split(":");
    const salesPointId = Number(spIdStr);
    const storageLocationId = Number(locIdStr);
    const productId = Number(productIdStr);
    const loc = locName.get(storageLocationId);
    if (!loc || loc.salesPointId !== salesPointId) continue;
    const qtyKg = q.sellableKg.add(q.unsellableKg);
    const arr = rowsBySp.get(salesPointId) ?? [];
    arr.push({
      storageLocationId,
      storageLocationName: loc.name,
      productId,
      productName: productName.get(productId) ?? `Product ${productId}`,
      qtyKg,
      remark: q.unsellableKg.gt(0) ? "Unsellable" : "Sellable",
      sellableKg: q.sellableKg,
      unsellableKg: q.unsellableKg,
    });
    rowsBySp.set(salesPointId, arr);
  }

  const sections: StockOnHandBySalesPointSection[] = [];
  let grandTotalKg = z;
  let grandSellableKg = z;
  let grandUnsellableKg = z;
  for (const spId of [...rowsBySp.keys()].sort((a, b) =>
    (spName.get(a) ?? String(a)).localeCompare(spName.get(b) ?? String(b), undefined, {
      sensitivity: "base",
    }),
  )) {
    const rows = (rowsBySp.get(spId) ?? []).sort((a, b) => {
      const byLoc = a.storageLocationName.localeCompare(b.storageLocationName, undefined, {
        sensitivity: "base",
      });
      if (byLoc !== 0) return byLoc;
      return a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" });
    });
    const totalKg = rows.reduce((acc, r) => acc.add(r.qtyKg), z);
    const sellableTotalKg = rows.reduce((acc, r) => acc.add(r.sellableKg), z);
    const unsellableTotalKg = rows.reduce((acc, r) => acc.add(r.unsellableKg), z);
    grandTotalKg = grandTotalKg.add(totalKg);
    grandSellableKg = grandSellableKg.add(sellableTotalKg);
    grandUnsellableKg = grandUnsellableKg.add(unsellableTotalKg);
    sections.push({
      salesPointId: spId,
      salesPointName: spName.get(spId) ?? `Sales point ${spId}`,
      rows,
      totalKg,
      sellableTotalKg,
      unsellableTotalKg,
    });
  }

  return {
    settings,
    scopedToSalesPoint,
    assignedSalesPointId,
    assignedSalesPointName,
    sections,
    grandTotalKg,
    grandSellableKg,
    grandUnsellableKg,
  };
}

export function fmtKgOnHand(d: Prisma.Decimal): string {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

