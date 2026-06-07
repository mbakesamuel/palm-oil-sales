import "server-only";

import { Prisma, StockMovementKind } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { getPrismaClient } from "@/lib/prisma";
import { productWhereBottled, uomForCategory } from "@/lib/product-form";
import { resolveBotaSalesPointId } from "@/lib/pos/sale-product-mode";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { productWhereForScope, resolveServiceScope } from "@/lib/service-scope";
import {
  movementSignedDelta,
  type AdjustmentLineForDelta,
} from "@/lib/stock/movement-signed-delta";
import { STOCK_MOVEMENT_KIND_LABELS } from "@/lib/stock/display";

const z = new Prisma.Decimal(0);
const LEDGER_LIMIT = 500;

export type BotaBottleStockLedgerRow = {
  id: string;
  occurredAtIso: string;
  productId: number;
  productName: string;
  uom: string;
  storageLocationName: string;
  kind: StockMovementKind;
  kindLabel: string;
  inQty: string | null;
  outQty: string | null;
  balanceQty: string;
  documentNo: string | null;
  userName: string;
  notes: string | null;
};

export type BotaBottleStockProductOption = {
  value: string;
  label: string;
};

export type BotaBottleStockSummary = {
  totalIn: string;
  totalOut: string;
  balance: string;
  uom: string;
  movementCount: number;
};

export type BotaBottleStockReportData = {
  botaSalesPointName: string;
  selectedProductId: string;
  productInvalid: boolean;
  productOptions: BotaBottleStockProductOption[];
  rows: BotaBottleStockLedgerRow[];
  summary: BotaBottleStockSummary;
  showProductColumn: boolean;
  truncated: boolean;
};

export type BotaBottleStockDenied =
  | { type: "not-configured" }
  | { type: "bota-only" }
  | { type: "no-sales-point" };

function dec(v: Prisma.Decimal | string | number): Prisma.Decimal {
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
}

function fmtQty(qty: Prisma.Decimal, uom: string): string {
  const n = qty.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP).toNumber();
  return uom ? `${n.toLocaleString(undefined)} ${uom}` : n.toLocaleString(undefined);
}

function balanceKey(productId: number, storageLocationId: number, condition: string) {
  return `${productId}:${storageLocationId}:${condition}`;
}

export async function loadBotaBottleStockReport(
  session: AuthSession,
  searchParams?: { productId?: string },
): Promise<BotaBottleStockReportData | BotaBottleStockDenied> {
  const prisma = getPrismaClient();
  const botaSalesPointId = await resolveBotaSalesPointId(prisma);

  if (botaSalesPointId == null) {
    return { type: "not-configured" };
  }

  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const assignedSalesPointId = session.salesPoint?.id ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return { type: "no-sales-point" };
  }

  if (
    scopedToSalesPoint &&
    assignedSalesPointId != null &&
    assignedSalesPointId !== botaSalesPointId
  ) {
    return { type: "bota-only" };
  }

  const botaSalesPoint = await prisma.salesPoint.findUnique({
    where: { id: botaSalesPointId },
    select: { name: true },
  });

  const scope = resolveServiceScope(session);

  const bottledProducts = await prisma.product.findMany({
    where: productWhereForScope(scope, productWhereBottled()),
    orderBy: [{ productName: "asc" }],
    select: {
      productId: true,
      productName: true,
      uom: true,
      productCat: { select: { isBottled: true } },
    },
  });

  const productOptions: BotaBottleStockProductOption[] = bottledProducts.map((p) => ({
    value: String(p.productId),
    label: p.productName,
  }));

  const rawProductId = String(searchParams?.productId ?? "").trim();
  let selectedProductId = rawProductId;
  let productInvalid = false;

  if (rawProductId !== "") {
    const pid = Number.parseInt(rawProductId, 10);
    if (!Number.isFinite(pid) || !bottledProducts.some((p) => p.productId === pid)) {
      productInvalid = true;
      selectedProductId = "";
    }
  }

  const productFilterId =
    selectedProductId !== "" ? Number.parseInt(selectedProductId, 10) : null;

  const movementWhere: Prisma.StockMovementWhereInput = {
    salesPointId: botaSalesPointId,
    product: productWhereBottled(),
    ...(productFilterId != null ? { productId: productFilterId } : {}),
  };

  const [movementRows, balanceRows] = await Promise.all([
    prisma.stockMovement.findMany({
      where: movementWhere,
      include: {
        storageLocation: { select: { name: true } },
        product: {
          select: {
            productName: true,
            uom: true,
            productCat: { select: { isBottled: true } },
          },
        },
        user: { select: { name: true } },
      },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.stockBalance.findMany({
      where: {
        salesPointId: botaSalesPointId,
        product: productWhereBottled(),
        ...(productFilterId != null ? { productId: productFilterId } : {}),
      },
      select: { qty: true, product: { select: { productCat: { select: { isBottled: true } } } } },
    }),
  ]);

  const adjustmentSourceIds = [
    ...new Set(
      movementRows
        .filter(
          (m) =>
            m.kind === StockMovementKind.ADJUSTMENT && m.sourceKind === "ADJUSTMENT",
        )
        .map((m) => m.sourceId),
    ),
  ];

  const adjustmentLines =
    adjustmentSourceIds.length > 0
      ? await prisma.stockAdjustmentLine.findMany({
          where: { adjustmentId: { in: adjustmentSourceIds } },
          select: {
            adjustmentId: true,
            productId: true,
            storageLocationId: true,
            deltaQty: true,
            fromCondition: true,
            toCondition: true,
          },
        })
      : [];

  const linesByAdjustmentId = new Map<string, AdjustmentLineForDelta[]>();
  for (const line of adjustmentLines) {
    const arr = linesByAdjustmentId.get(line.adjustmentId) ?? [];
    arr.push({
      productId: line.productId,
      storageLocationId: line.storageLocationId,
      deltaQty: line.deltaQty,
      fromCondition: line.fromCondition,
      toCondition: line.toCondition,
    });
    linesByAdjustmentId.set(line.adjustmentId, arr);
  }

  const truncated = movementRows.length > LEDGER_LIMIT;
  const displayMovementRows = truncated
    ? movementRows.slice(movementRows.length - LEDGER_LIMIT)
    : movementRows;

  const sourceIds = {
    RECEIPT: displayMovementRows
      .filter((r) => r.sourceKind === "RECEIPT")
      .map((r) => r.sourceId),
    TRANSFER: displayMovementRows
      .filter((r) => r.sourceKind === "TRANSFER")
      .map((r) => r.sourceId),
    SALE: displayMovementRows.filter((r) => r.sourceKind === "SALE").map((r) => r.sourceId),
    ADJUSTMENT: displayMovementRows
      .filter((r) => r.sourceKind === "ADJUSTMENT")
      .map((r) => r.sourceId),
  };

  const [receipts, transfers, sales, adjustments] = await Promise.all([
    sourceIds.RECEIPT.length
      ? prisma.stockReceipt.findMany({
          where: { id: { in: sourceIds.RECEIPT } },
          select: { id: true, receiptNo: true },
        })
      : Promise.resolve([] as { id: string; receiptNo: string }[]),
    sourceIds.TRANSFER.length
      ? prisma.stockTransfer.findMany({
          where: { id: { in: sourceIds.TRANSFER } },
          select: { id: true, transferNo: true },
        })
      : Promise.resolve([] as { id: string; transferNo: string }[]),
    sourceIds.SALE.length
      ? prisma.sale.findMany({
          where: { id: { in: sourceIds.SALE } },
          select: { id: true, invoiceNo: true },
        })
      : Promise.resolve([] as { id: string; invoiceNo: string }[]),
    sourceIds.ADJUSTMENT.length
      ? prisma.stockAdjustment.findMany({
          where: { id: { in: sourceIds.ADJUSTMENT } },
          select: { id: true, adjustmentNo: true },
        })
      : Promise.resolve([] as { id: string; adjustmentNo: string }[]),
  ]);

  const docNoById = new Map<string, string>();
  for (const r of receipts) docNoById.set(`RECEIPT:${r.id}`, r.receiptNo);
  for (const t of transfers) docNoById.set(`TRANSFER:${t.id}`, t.transferNo);
  for (const s of sales) docNoById.set(`SALE:${s.id}`, s.invoiceNo);
  for (const a of adjustments) docNoById.set(`ADJUSTMENT:${a.id}`, a.adjustmentNo);

  const runningBalances = new Map<string, Prisma.Decimal>();
  const defaultUom =
    bottledProducts[0] != null
      ? bottledProducts[0].uom?.trim() ||
        uomForCategory(bottledProducts[0].productCat)
      : "Unit";

  // Global IN/OUT totals use the full ledger; display may show the latest slice only.
  let globalTotalIn = z;
  let globalTotalOut = z;
  for (const r of movementRows) {
    const signed = movementSignedDelta(
      {
        kind: r.kind,
        qty: r.qty,
        sourceKind: r.sourceKind,
        sourceId: r.sourceId,
        productId: r.productId,
        storageLocationId: r.storageLocationId,
        condition: r.condition,
        notes: r.notes,
      },
      linesByAdjustmentId,
    );
    if (signed.gt(0)) globalTotalIn = globalTotalIn.add(signed);
    if (signed.lt(0)) globalTotalOut = globalTotalOut.add(signed.abs());
  }

  const ledgerByMovementId = new Map<string, BotaBottleStockLedgerRow>();

  for (const r of movementRows) {
    const uom =
      r.product.uom?.trim() || uomForCategory(r.product.productCat);
    const signed = movementSignedDelta(
      {
        kind: r.kind,
        qty: r.qty,
        sourceKind: r.sourceKind,
        sourceId: r.sourceId,
        productId: r.productId,
        storageLocationId: r.storageLocationId,
        condition: r.condition,
        notes: r.notes,
      },
      linesByAdjustmentId,
    );

    const key = balanceKey(r.productId, r.storageLocationId, r.condition);
    const prev = runningBalances.get(key) ?? z;
    const next = prev.add(signed);
    runningBalances.set(key, next);

    const absQty = dec(r.qty).abs();
    ledgerByMovementId.set(r.id, {
      id: r.id,
      occurredAtIso: r.occurredAt.toISOString(),
      productId: r.productId,
      productName: r.product.productName,
      uom,
      storageLocationName: r.storageLocation.name,
      kind: r.kind,
      kindLabel: STOCK_MOVEMENT_KIND_LABELS[r.kind],
      inQty: signed.gt(0) ? absQty.toString() : null,
      outQty: signed.lt(0) ? absQty.toString() : null,
      balanceQty: next.toString(),
      documentNo: docNoById.get(`${r.sourceKind}:${r.sourceId}`) ?? null,
      userName: r.user.name,
      notes: r.notes ?? null,
    });
  }

  const rows = displayMovementRows
    .map((r) => ledgerByMovementId.get(r.id))
    .filter((r): r is BotaBottleStockLedgerRow => r != null);

  const liveBalance = balanceRows.reduce((acc, b) => acc.add(b.qty), z);

  const summaryUom =
    productFilterId != null
      ? (bottledProducts.find((p) => p.productId === productFilterId)?.uom?.trim() ||
        uomForCategory(
          bottledProducts.find((p) => p.productId === productFilterId)?.productCat,
        ))
      : defaultUom;

  return {
    botaSalesPointName: botaSalesPoint?.name ?? "Bota",
    selectedProductId,
    productInvalid,
    productOptions,
    rows: productInvalid ? [] : rows,
    summary: {
      totalIn: globalTotalIn.toString(),
      totalOut: globalTotalOut.toString(),
      balance: liveBalance.toString(),
      uom: summaryUom,
      movementCount: movementRows.length,
    },
    showProductColumn: productFilterId == null,
    truncated,
  };
}

export function fmtBotaBottleQty(qty: string, uom: string): string {
  return fmtQty(dec(qty), uom);
}
