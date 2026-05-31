import { Prisma, StockCondition, StockMovementKind } from "@prisma/client";

const z = new Prisma.Decimal(0);

const INCREMENT_KINDS: ReadonlySet<StockMovementKind> = new Set([
  StockMovementKind.RECEIPT,
  StockMovementKind.TRANSFER_IN,
  StockMovementKind.SALE_REVERSAL,
]);

export type AdjustmentLineForDelta = {
  productId: number;
  storageLocationId: number;
  deltaQty: Prisma.Decimal;
  fromCondition: StockCondition | null;
  toCondition: StockCondition | null;
};

export type MovementForSignedDelta = {
  kind: StockMovementKind;
  qty: Prisma.Decimal;
  sourceKind: string;
  sourceId: string;
  productId: number;
  storageLocationId: number;
  condition: StockCondition;
  notes: string | null;
};

function dec(v: Prisma.Decimal | string | number): Prisma.Decimal {
  return v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v);
}

function adjustmentMovementSignedDelta(
  m: MovementForSignedDelta,
  lines: AdjustmentLineForDelta[],
): Prisma.Decimal {
  const q = dec(m.qty);
  for (const line of lines) {
    if (
      line.productId !== m.productId ||
      line.storageLocationId !== m.storageLocationId
    ) {
      continue;
    }
    const d = dec(line.deltaQty);
    if (line.fromCondition && line.toCondition) {
      if (m.condition === line.fromCondition) return d.abs().neg();
      if (m.condition === line.toCondition) return d.abs();
      continue;
    }
    return d;
  }
  return z;
}

function reversalAdjustmentSignedDelta(m: MovementForSignedDelta): Prisma.Decimal {
  const q = dec(m.qty);
  const notes = m.notes ?? "";
  const kindMatch = notes.match(/\(([A-Z_]+)\)\s*$/);
  const orig = kindMatch?.[1];
  if (orig === "RECEIPT" || orig === "TRANSFER_IN" || orig === "ADJUSTMENT") {
    return q.neg();
  }
  if (orig === "TRANSFER_OUT") return q;
  return z;
}

/** Net balance change implied by one ledger row (matches `lib/stock/post.ts` posting rules). */
export function movementSignedDelta(
  m: MovementForSignedDelta,
  adjustmentLinesBySourceId: Map<string, AdjustmentLineForDelta[]>,
): Prisma.Decimal {
  const q = dec(m.qty);
  if (INCREMENT_KINDS.has(m.kind)) return q;
  if (
    m.kind === StockMovementKind.TRANSFER_OUT ||
    m.kind === StockMovementKind.SALE
  ) {
    return q.neg();
  }
  if (m.kind === StockMovementKind.ADJUSTMENT) {
    if (m.sourceKind === "ADJUSTMENT") {
      return adjustmentMovementSignedDelta(
        m,
        adjustmentLinesBySourceId.get(m.sourceId) ?? [],
      );
    }
    /** Receipt cancel posts ADJUSTMENT with sourceKind RECEIPT (see `reverseMovementsBySource`). */
    if (m.sourceKind === "RECEIPT") {
      return q.neg();
    }
    if (m.notes?.includes("Reversal of movement")) {
      return reversalAdjustmentSignedDelta(m);
    }
  }
  return z;
}
