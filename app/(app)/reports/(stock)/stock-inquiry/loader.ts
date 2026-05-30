import "server-only";

import { Prisma, StockCondition } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  normalizeIsoDateInput,
  utcIsoDateToday,
} from "@/lib/posting-calendar";
import { getOrInitCompanySettings } from "@/lib/settings";
import { loadPositiveBalancesAsAt } from "@/lib/stock/balances-as-at";

const z = new Prisma.Decimal(0);

export const STOCK_INQUIRY_CONDITIONS = ["all", "SELLABLE", "UNSELLABLE"] as const;
export type StockInquiryConditionFilter = (typeof STOCK_INQUIRY_CONDITIONS)[number];

export const STOCK_INQUIRY_CONDITION_LABELS: Record<
  StockInquiryConditionFilter,
  string
> = {
  all: "All (sellable + unsellable)",
  SELLABLE: "Sellable only",
  UNSELLABLE: "Unsellable only",
};

export type StockInquiryFilterOption = { value: string; label: string };

export type StockInquiryRow = {
  salesPointId: number;
  salesPointName: string;
  storageLocationId: number;
  storageLocationName: string;
  productId: number;
  productName: string;
  uom: string;
  condition: StockCondition;
  qty: Prisma.Decimal;
};

export type StockInquirySection = {
  salesPointId: number;
  salesPointName: string;
  rows: StockInquiryRow[];
  totalRows: number;
};

export type StockInquiryUomTotal = { uom: string; qty: Prisma.Decimal };

export type StockInquiryProductSummary = {
  productId: number;
  productName: string;
  uom: string;
  qty: Prisma.Decimal;
  lineCount: number;
};

export type StockInquiryConditionSummary = {
  condition: StockCondition;
  label: string;
  totalsByUom: StockInquiryUomTotal[];
  lineCount: number;
};

export type StockInquiryReportData = {
  settings: Awaited<ReturnType<typeof getOrInitCompanySettings>>;
  scopedToSalesPoint: boolean;
  assignedSalesPointId: number | null;
  assignedSalesPointName: string | null;
  productOptions: StockInquiryFilterOption[];
  /** Point-scoped roles: filter by storage location within their sales point. */
  locationOptions: StockInquiryFilterOption[];
  /** Consolidated roles: filter by sales point across the network. */
  salesPointOptions: StockInquiryFilterOption[];
  selectedProductId: string;
  selectedLocationId: string;
  selectedSalesPointId: string;
  selectedCondition: StockInquiryConditionFilter;
  selectedAsAt: string;
  isLiveStock: boolean;
  asAtInvalid: boolean;
  asAtFuture: boolean;
  productInvalid: boolean;
  locationInvalid: boolean;
  salesPointInvalid: boolean;
  sections: StockInquirySection[];
  rowCount: number;
  productSummaries: StockInquiryProductSummary[];
  conditionSummaries: StockInquiryConditionSummary[];
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

function parseCondition(raw: string | undefined): StockInquiryConditionFilter {
  if (raw === "SELLABLE" || raw === "UNSELLABLE") return raw;
  return "all";
}

function parseAsAt(raw: string | undefined): {
  selectedAsAt: string;
  asAtIso: string | null;
  asAtInvalid: boolean;
  asAtFuture: boolean;
  isLiveStock: boolean;
} {
  const selectedAsAt = raw?.trim() ?? "";
  if (!selectedAsAt) {
    return {
      selectedAsAt: "",
      asAtIso: null,
      asAtInvalid: false,
      asAtFuture: false,
      isLiveStock: true,
    };
  }
  const asAtIso = normalizeIsoDateInput(selectedAsAt);
  if (!asAtIso) {
    return {
      selectedAsAt,
      asAtIso: null,
      asAtInvalid: true,
      asAtFuture: false,
      isLiveStock: true,
    };
  }
  const today = utcIsoDateToday();
  if (asAtIso > today) {
    return {
      selectedAsAt: asAtIso,
      asAtIso,
      asAtInvalid: true,
      asAtFuture: true,
      isLiveStock: false,
    };
  }
  return {
    selectedAsAt: asAtIso,
    asAtIso,
    asAtInvalid: false,
    asAtFuture: false,
    isLiveStock: asAtIso === today,
  };
}

export async function loadStockInquiryReport(
  session: AuthSession,
  searchParams?: {
    productId?: string;
    locationId?: string;
    salesPointId?: string;
    condition?: string;
    asAt?: string;
  },
): Promise<StockInquiryReportData | { type: "no-sales-point" }> {
  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return { type: "no-sales-point" };
  }

  const selectedProductId = searchParams?.productId?.trim() ?? "";
  const selectedLocationId = searchParams?.locationId?.trim() ?? "";
  const selectedSalesPointId = searchParams?.salesPointId?.trim() ?? "";
  const selectedCondition = parseCondition(searchParams?.condition);
  const filterProductId = parseOptionalId(selectedProductId);
  const filterLocationId = scopedToSalesPoint
    ? parseOptionalId(selectedLocationId)
    : null;
  const filterSalesPointId = scopedToSalesPoint
    ? null
    : parseOptionalId(selectedSalesPointId);
  const asAtParsed = parseAsAt(searchParams?.asAt);

  const [settings, prisma] = await Promise.all([
    getOrInitCompanySettings(),
    getPrismaClient(),
  ]);

  const scopedSalesPointId =
    scopedToSalesPoint && assignedSalesPointId != null
      ? assignedSalesPointId
      : null;

  const allBalances = asAtParsed.asAtInvalid
    ? []
    : await loadPositiveBalancesAsAt({
        salesPointId: scopedSalesPointId,
        asAtIso: asAtParsed.asAtIso,
      });

  const productIds = [...new Set(allBalances.map((b) => b.productId))];
  const locationIds = [...new Set(allBalances.map((b) => b.storageLocationId))];
  const salesPointIds = [...new Set(allBalances.map((b) => b.salesPointId))];

  const [products, locations, salesPoints] = await Promise.all([
    prismaRetry(() =>
      prisma.product.findMany({
        where: { productId: { in: productIds.length > 0 ? productIds : [-1] } },
        select: {
          productId: true,
          productName: true,
          uom: true,
          productCat: { select: { isBottled: true } },
        },
        orderBy: { productName: "asc" },
      }),
    ),
    prismaRetry(() =>
      prisma.storageLocation.findMany({
        where: { id: { in: locationIds.length > 0 ? locationIds : [-1] } },
        select: { id: true, name: true, salesPointId: true },
        orderBy: [{ salesPointId: "asc" }, { name: "asc" }],
      }),
    ),
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        where: { id: { in: salesPointIds.length > 0 ? salesPointIds : [-1] } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ),
  ]);

  const spName = new Map<number, string>(salesPoints.map((s) => [s.id, s.name]));
  const locById = new Map(locations.map((l) => [l.id, l]));
  const productById = new Map(products.map((p) => [p.productId, p]));

  const validProductIds = new Set(products.map((p) => p.productId));
  const validLocationIds = new Set(locations.map((l) => l.id));
  const validSalesPointIds = new Set(salesPoints.map((s) => s.id));
  const productInvalid =
    filterProductId != null && !validProductIds.has(filterProductId);
  const locationInvalid =
    scopedToSalesPoint &&
    filterLocationId != null &&
    !validLocationIds.has(filterLocationId);
  const salesPointInvalid =
    !scopedToSalesPoint &&
    filterSalesPointId != null &&
    !validSalesPointIds.has(filterSalesPointId);

  const productOptions: StockInquiryFilterOption[] = products.map((p) => ({
    value: String(p.productId),
    label: p.productName,
  }));

  const locationOptions: StockInquiryFilterOption[] = scopedToSalesPoint
    ? locations.map((l) => ({
        value: String(l.id),
        label: l.name,
      }))
    : [];

  const salesPointOptions: StockInquiryFilterOption[] = salesPoints.map((s) => ({
    value: String(s.id),
    label: s.name,
  }));

  const filteredBalances = allBalances.filter((b) => {
    if (
      asAtParsed.asAtInvalid ||
      productInvalid ||
      locationInvalid ||
      salesPointInvalid
    ) {
      return false;
    }
    if (filterProductId != null && b.productId !== filterProductId) return false;
    if (filterLocationId != null && b.storageLocationId !== filterLocationId) {
      return false;
    }
    if (filterSalesPointId != null && b.salesPointId !== filterSalesPointId) {
      return false;
    }
    if (selectedCondition !== "all" && b.condition !== selectedCondition) {
      return false;
    }
    return true;
  });

  const rowsBySp = new Map<number, StockInquiryRow[]>();
  for (const b of filteredBalances) {
    const loc = locById.get(b.storageLocationId);
    const product = productById.get(b.productId);
    if (!loc || loc.salesPointId !== b.salesPointId) continue;
    const uom =
      product?.uom?.trim() ||
      (product?.productCat?.isBottled ? "Units" : "Kg");
    const arr = rowsBySp.get(b.salesPointId) ?? [];
    arr.push({
      salesPointId: b.salesPointId,
      salesPointName: spName.get(b.salesPointId) ?? `Sales point ${b.salesPointId}`,
      storageLocationId: b.storageLocationId,
      storageLocationName: loc.name,
      productId: b.productId,
      productName: product?.productName ?? `Product ${b.productId}`,
      uom,
      condition: b.condition,
      qty: dec(b.qty),
    });
    rowsBySp.set(b.salesPointId, arr);
  }

  const sections: StockInquirySection[] = [];
  let rowCount = 0;
  for (const spId of [...rowsBySp.keys()].sort((a, b) =>
    (spName.get(a) ?? String(a)).localeCompare(spName.get(b) ?? String(b), undefined, {
      sensitivity: "base",
    }),
  )) {
    const rows = (rowsBySp.get(spId) ?? []).sort((a, b) => {
      const byLoc = a.storageLocationName.localeCompare(
        b.storageLocationName,
        undefined,
        { sensitivity: "base" },
      );
      if (byLoc !== 0) return byLoc;
      const byProd = a.productName.localeCompare(b.productName, undefined, {
        sensitivity: "base",
      });
      if (byProd !== 0) return byProd;
      return a.condition.localeCompare(b.condition);
    });
    rowCount += rows.length;
    sections.push({
      salesPointId: spId,
      salesPointName: spName.get(spId) ?? `Sales point ${spId}`,
      rows,
      totalRows: rows.length,
    });
  }

  const allRows = sections.flatMap((s) => s.rows);
  const { productSummaries, conditionSummaries } =
    buildStockInquirySummaries(allRows);

  return {
    settings,
    scopedToSalesPoint,
    assignedSalesPointId,
    assignedSalesPointName,
    productOptions,
    locationOptions,
    salesPointOptions,
    selectedProductId,
    selectedLocationId,
    selectedSalesPointId,
    selectedCondition,
    selectedAsAt: asAtParsed.selectedAsAt,
    isLiveStock: asAtParsed.isLiveStock,
    asAtInvalid: asAtParsed.asAtInvalid,
    asAtFuture: asAtParsed.asAtFuture,
    productInvalid,
    locationInvalid,
    salesPointInvalid,
    sections,
    rowCount,
    productSummaries,
    conditionSummaries,
  };
}

function buildStockInquirySummaries(rows: StockInquiryRow[]): {
  productSummaries: StockInquiryProductSummary[];
  conditionSummaries: StockInquiryConditionSummary[];
} {
  const byProduct = new Map<
    number,
    { productName: string; uom: string; qty: Prisma.Decimal; lineCount: number }
  >();
  for (const r of rows) {
    const ex = byProduct.get(r.productId);
    if (!ex) {
      byProduct.set(r.productId, {
        productName: r.productName,
        uom: r.uom,
        qty: dec(r.qty),
        lineCount: 1,
      });
      continue;
    }
    ex.qty = ex.qty.add(r.qty);
    ex.lineCount += 1;
  }

  const productSummaries: StockInquiryProductSummary[] = [...byProduct.entries()]
    .map(([productId, v]) => ({
      productId,
      productName: v.productName,
      uom: v.uom,
      qty: v.qty,
      lineCount: v.lineCount,
    }))
    .sort((a, b) =>
      a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" }),
    );

  const conditionOrder: StockCondition[] = [
    StockCondition.SELLABLE,
    StockCondition.UNSELLABLE,
  ];
  const conditionSummaries: StockInquiryConditionSummary[] = conditionOrder.map(
    (condition) => {
      const matching = rows.filter((r) => r.condition === condition);
      const byUom = new Map<string, Prisma.Decimal>();
      for (const r of matching) {
        byUom.set(r.uom, (byUom.get(r.uom) ?? z).add(r.qty));
      }
      const totalsByUom: StockInquiryUomTotal[] = [...byUom.entries()]
        .map(([uom, qty]) => ({ uom, qty }))
        .sort((a, b) => a.uom.localeCompare(b.uom, undefined, { sensitivity: "base" }));
      return {
        condition,
        label: conditionLabel(condition),
        totalsByUom,
        lineCount: matching.length,
      };
    },
  );

  return { productSummaries, conditionSummaries };
}

export function fmtStockQty(d: Prisma.Decimal, uom: string): string {
  const isKg = uom.toLowerCase() === "kg";
  const n = Number(
    d.toDecimalPlaces(isKg ? 3 : 0, Prisma.Decimal.ROUND_HALF_UP),
  );
  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: isKg ? 3 : 0,
    minimumFractionDigits: 0,
  }).format(n)} ${uom}`;
}

export function conditionLabel(c: StockCondition): string {
  return c === StockCondition.UNSELLABLE ? "Unsellable" : "Sellable";
}

export function formatAsAtLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map((x) => Number.parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}
