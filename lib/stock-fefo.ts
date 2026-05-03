import "server-only";

import { Prisma } from "@prisma/client";

export class StockInsufficientError extends Error {
  override name = "StockInsufficientError";
  constructor(message: string) {
    super(message);
  }
}

export type SaleLineForStock = {
  id: string;
  productId: number;
  qtyKg: Prisma.Decimal;
  product: { productName: string };
};

const z = new Prisma.Decimal(0);

/**
 * FEFO: allocate validated sale lines against batches at the sales point; decrement batches and
 * create SaleLineBatchAllocation rows. Call inside a transaction (Serializable recommended).
 *
 * One logical pool per collection point × product: batch `storageLocationId` is ignored here so
 * sales draw from all tanks/locations at that point in receipt-date order.
 */
export async function applyFefoStockDeduction(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  lines: SaleLineForStock[],
): Promise<void> {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const batches = await tx.batch.findMany({
    where: {
      salesPointId,
      productId: { in: productIds },
      qtyRemainingKg: { gt: 0 },
    },
    orderBy: [{ productId: "asc" }, { receivedAt: "asc" }],
  });

  const remaining = new Map<string, Prisma.Decimal>();
  for (const b of batches) {
    remaining.set(b.id, new Prisma.Decimal(b.qtyRemainingKg));
  }

  const byProduct = new Map<number, typeof batches>();
  for (const b of batches) {
    const arr = byProduct.get(b.productId) ?? [];
    arr.push(b);
    byProduct.set(b.productId, arr);
  }

  const allocations: Array<{ saleLineId: string; batchId: string; qtyKg: Prisma.Decimal }> = [];

  for (const line of lines) {
    let need = new Prisma.Decimal(line.qtyKg);
    if (need.lte(0)) continue;
    const pool = byProduct.get(line.productId) ?? [];
    for (const b of pool) {
      if (need.lte(0)) break;
      const rem = remaining.get(b.id);
      if (!rem || rem.lte(0)) continue;
      const take = need.lt(rem) ? need : rem;
      if (take.lte(0)) continue;
      allocations.push({ saleLineId: line.id, batchId: b.id, qtyKg: take });
      remaining.set(b.id, rem.sub(take));
      need = need.sub(take);
    }
    if (need.gt(0)) {
      throw new StockInsufficientError(
        `Insufficient stock for ${line.product.productName} at this sales point (short by ${need.toDecimalPlaces(3).toString()} kg).`,
      );
    }
  }

  const decrementByBatch = new Map<string, Prisma.Decimal>();
  for (const a of allocations) {
    decrementByBatch.set(a.batchId, (decrementByBatch.get(a.batchId) ?? z).add(a.qtyKg));
  }

  for (const [batchId, dec] of decrementByBatch) {
    await tx.batch.update({
      where: { id: batchId },
      data: { qtyRemainingKg: { decrement: dec } },
    });
  }

  for (const a of allocations) {
    await tx.saleLineBatchAllocation.create({
      data: {
        saleLineId: a.saleLineId,
        batchId: a.batchId,
        qtyKg: a.qtyKg,
      },
    });
  }
}
