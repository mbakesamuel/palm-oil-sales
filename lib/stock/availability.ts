import "server-only";

import { Prisma, StockCondition } from "@prisma/client";
import { InsufficientStockError } from "@/lib/stock/errors";

type Tx = Prisma.TransactionClient;

export type AssertSufficientStockInput = {
  salesPointId: number;
  storageLocationId: number;
  productId: number;
  qty: Prisma.Decimal | number | string;
};

function toDecimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

async function lookupLabels(
  tx: Tx,
  salesPointId: number,
  productId: number,
  storageLocationId: number,
): Promise<{
  salesPointLabel: string;
  productLabel: string;
  storageLocationLabel: string;
}> {
  const [sp, product, location] = await Promise.all([
    tx.salesPoint.findUnique({ where: { id: salesPointId }, select: { name: true } }),
    tx.product.findUnique({
      where: { productId },
      select: { productName: true },
    }),
    tx.storageLocation.findUnique({
      where: { id: storageLocationId },
      select: { name: true },
    }),
  ]);
  return {
    salesPointLabel: sp?.name ?? `Sales point ${salesPointId}`,
    productLabel: product?.productName ?? `Product ${productId}`,
    storageLocationLabel: location?.name ?? `Location ${storageLocationId}`,
  };
}

/**
 * Ensures on-hand stock at a specific bin covers the requested quantity.
 * MUST be called inside `prisma.$transaction(...)`.
 */
export async function assertSufficientStockAtLocation(
  tx: Tx,
  input: AssertSufficientStockInput,
): Promise<void> {
  const requested = toDecimal(input.qty);
  if (requested.lte(0)) return;

  const balance = await tx.stockBalance.findUnique({
    where: {
      salesPointId_productId_storageLocationId_condition: {
        salesPointId: input.salesPointId,
        productId: input.productId,
        storageLocationId: input.storageLocationId,
        condition: StockCondition.SELLABLE,
      },
    },
    select: { qty: true },
  });

  const available = balance?.qty ?? new Prisma.Decimal(0);
  if (available.gte(requested)) return;

  const { salesPointLabel, productLabel, storageLocationLabel } = await lookupLabels(
    tx,
    input.salesPointId,
    input.productId,
    input.storageLocationId,
  );

  throw new InsufficientStockError({
    salesPointId: input.salesPointId,
    productId: input.productId,
    productLabel,
    salesPointLabel,
    storageLocationLabel,
    condition: StockCondition.SELLABLE,
    requested: requested.toString(),
    available: available.toString(),
  });
}

export type TransferLineQty = {
  productId: number;
  fromStorageLocationId: number;
  qty: Prisma.Decimal;
};

/** Sum duplicate product/from-location lines, then assert each group has enough stock. */
export async function assertTransferLinesAvailableAtSource(
  tx: Tx,
  fromSalesPointId: number,
  lines: TransferLineQty[],
): Promise<void> {
  const aggregated = new Map<
    string,
    { productId: number; fromStorageLocationId: number; qty: Prisma.Decimal }
  >();

  for (const line of lines) {
    const key = `${line.productId}:${line.fromStorageLocationId}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.qty = existing.qty.add(line.qty);
    } else {
      aggregated.set(key, {
        productId: line.productId,
        fromStorageLocationId: line.fromStorageLocationId,
        qty: line.qty,
      });
    }
  }

  for (const group of aggregated.values()) {
    await assertSufficientStockAtLocation(tx, {
      salesPointId: fromSalesPointId,
      storageLocationId: group.fromStorageLocationId,
      productId: group.productId,
      qty: group.qty,
    });
  }
}
