import "server-only";

import { Prisma, StockMovementKind } from "@prisma/client";
import { InsufficientStockError } from "@/lib/stock/errors";

type Tx = Prisma.TransactionClient;

/** Stable, non-DB string used on StockMovement.sourceKind so we can join back to the parent document. */
export type StockSourceKind = "RECEIPT" | "TRANSFER" | "SALE" | "ADJUSTMENT";

export type ApplyMovementInput = {
  salesPointId: number;
  productId: number;
  /** Positive magnitude; sign is decided from `kind`. */
  qty: Prisma.Decimal | number | string;
  kind: StockMovementKind;
  occurredAt: Date;
  userId: string;
  sourceKind: StockSourceKind;
  sourceId: string;
  notes?: string | null;
};

// Use string literals (not enum members) so this evaluates even if a stale bundler cache
// has not yet picked up the regenerated Prisma client. The string values are identical
// to the enum members and are still type-checked against `StockMovementKind`.
const INCREMENT_KINDS: ReadonlySet<StockMovementKind> = new Set<StockMovementKind>([
  "RECEIPT",
  "TRANSFER_IN",
  "SALE_REVERSAL",
]);

function toDecimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

async function lookupLabels(
  tx: Tx,
  salesPointId: number,
  productId: number,
): Promise<{ salesPointLabel: string; productLabel: string }> {
  const [sp, product] = await Promise.all([
    tx.salesPoint.findUnique({ where: { id: salesPointId }, select: { name: true } }),
    tx.product.findUnique({
      where: { productId },
      select: { productName: true },
    }),
  ]);
  return {
    salesPointLabel: sp?.name ?? `Sales point ${salesPointId}`,
    productLabel: product?.productName ?? `Product ${productId}`,
  };
}

/**
 * Append one movement to the ledger and update StockBalance atomically.
 *
 * MUST be called inside `prisma.$transaction(...)`. For decrement kinds the balance is
 * decremented through a conditional `updateMany` keyed on `qty >= delta`, so concurrent
 * postings cannot drive the balance below zero. ADJUSTMENT can be either sign.
 */
export async function applyMovement(tx: Tx, input: ApplyMovementInput): Promise<void> {
  const qty = toDecimal(input.qty);

  if (input.kind === StockMovementKind.ADJUSTMENT) {
    if (qty.eq(0)) return;
  } else {
    if (qty.lte(0)) {
      throw new Error("Stock movement quantity must be greater than zero.");
    }
  }

  await tx.stockMovement.create({
    data: {
      salesPointId: input.salesPointId,
      productId: input.productId,
      kind: input.kind,
      qty: qty.abs(),
      occurredAt: input.occurredAt,
      userId: input.userId,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      notes: input.notes ?? null,
    },
  });

  if (INCREMENT_KINDS.has(input.kind) || (input.kind === StockMovementKind.ADJUSTMENT && qty.gt(0))) {
    await tx.stockBalance.upsert({
      where: {
        salesPointId_productId: {
          salesPointId: input.salesPointId,
          productId: input.productId,
        },
      },
      create: {
        salesPointId: input.salesPointId,
        productId: input.productId,
        qty: qty.abs(),
      },
      update: { qty: { increment: qty.abs() } },
    });
    return;
  }

  const delta = qty.abs();
  const updated = await tx.stockBalance.updateMany({
    where: {
      salesPointId: input.salesPointId,
      productId: input.productId,
      qty: { gte: delta },
    },
    data: { qty: { decrement: delta } },
  });

  if (updated.count === 0) {
    const balance = await tx.stockBalance.findUnique({
      where: {
        salesPointId_productId: {
          salesPointId: input.salesPointId,
          productId: input.productId,
        },
      },
      select: { qty: true },
    });
    const { salesPointLabel, productLabel } = await lookupLabels(
      tx,
      input.salesPointId,
      input.productId,
    );
    throw new InsufficientStockError({
      salesPointId: input.salesPointId,
      productId: input.productId,
      productLabel,
      salesPointLabel,
      requested: delta.toString(),
      available: (balance?.qty ?? new Prisma.Decimal(0)).toString(),
    });
  }
}

export type ReverseMovementsInput = {
  sourceKind: StockSourceKind;
  sourceId: string;
  userId: string;
  /** Movement business date for the compensating entries (typically `new Date()`). */
  occurredAt: Date;
  notes?: string | null;
};

/**
 * Insert compensating movements that cancel every original movement linked to the given
 * source document, returning the count of reversal rows posted. Used when a validated
 * Sale is later rejected, or when a posted stock document is cancelled.
 */
export async function reverseMovementsBySource(
  tx: Tx,
  input: ReverseMovementsInput,
): Promise<number> {
  const originals = await tx.stockMovement.findMany({
    where: {
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      kind: {
        in: [
          StockMovementKind.RECEIPT,
          StockMovementKind.TRANSFER_OUT,
          StockMovementKind.TRANSFER_IN,
          StockMovementKind.SALE,
          StockMovementKind.ADJUSTMENT,
        ],
      },
    },
    select: {
      id: true,
      salesPointId: true,
      productId: true,
      kind: true,
      qty: true,
    },
  });

  let count = 0;
  for (const m of originals) {
    let reversalKind: StockMovementKind;
    let reversalQty: Prisma.Decimal | number;
    switch (m.kind) {
      case StockMovementKind.RECEIPT:
      case StockMovementKind.TRANSFER_IN:
        reversalKind = StockMovementKind.ADJUSTMENT;
        reversalQty = new Prisma.Decimal(m.qty).neg();
        break;
      case StockMovementKind.TRANSFER_OUT:
        reversalKind = StockMovementKind.ADJUSTMENT;
        reversalQty = new Prisma.Decimal(m.qty);
        break;
      case StockMovementKind.SALE:
        reversalKind = StockMovementKind.SALE_REVERSAL;
        reversalQty = new Prisma.Decimal(m.qty);
        break;
      case StockMovementKind.ADJUSTMENT: {
        reversalKind = StockMovementKind.ADJUSTMENT;
        reversalQty = new Prisma.Decimal(m.qty).neg();
        break;
      }
      default:
        continue;
    }

    await applyMovement(tx, {
      salesPointId: m.salesPointId,
      productId: m.productId,
      qty: reversalQty,
      kind: reversalKind,
      occurredAt: input.occurredAt,
      userId: input.userId,
      sourceKind: input.sourceKind,
      sourceId: input.sourceId,
      notes:
        input.notes ?? `Reversal of movement ${m.id} (${m.kind})`,
    });
    count += 1;
  }
  return count;
}
