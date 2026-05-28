import "server-only";

import { InsufficientStockError } from "@/lib/stock/errors";
import { Prisma, StockCondition } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

function dec(value: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal {
  if (value == null) return new Prisma.Decimal(0);
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export type LocationStockBreakdown = {
  sellableQty: Prisma.Decimal;
  unsellableQty: Prisma.Decimal;
};

export async function getLocationStockBreakdown(
  db: Db,
  salesPointId: number,
  storageLocationId: number,
  productId: number,
): Promise<LocationStockBreakdown> {
  const rows = await db.stockBalance.findMany({
    where: { salesPointId, storageLocationId, productId },
    select: { condition: true, qty: true },
  });

  let sellableQty = dec(0);
  let unsellableQty = dec(0);
  for (const row of rows) {
    if (row.condition === StockCondition.UNSELLABLE) {
      unsellableQty = unsellableQty.add(row.qty);
    } else {
      sellableQty = sellableQty.add(row.qty);
    }
  }

  return { sellableQty, unsellableQty };
}

/** POS may not sell from a bin that holds unsellable stock for the product. */
export function isPosLocationBlockedByUnsellableStock(
  breakdown: LocationStockBreakdown,
): boolean {
  return breakdown.unsellableQty.gt(0);
}

export async function assertPosLocationSellable(
  db: Db,
  input: {
    salesPointId: number;
    storageLocationId: number;
    productId: number;
    productName?: string;
    storageLocationName?: string;
  },
): Promise<void> {
  const breakdown = await getLocationStockBreakdown(
    db,
    input.salesPointId,
    input.storageLocationId,
    input.productId,
  );
  if (!isPosLocationBlockedByUnsellableStock(breakdown)) return;

  const [product, location] = await Promise.all([
    input.productName
      ? Promise.resolve({ productName: input.productName })
      : db.product.findUnique({
          where: { productId: input.productId },
          select: { productName: true },
        }),
    input.storageLocationName
      ? Promise.resolve({ name: input.storageLocationName })
      : db.storageLocation.findUnique({
          where: { id: input.storageLocationId },
          select: { name: true },
        }),
  ]);

  const productLabel = product?.productName ?? `Product ${input.productId}`;
  const locationLabel = location?.name ?? `Location ${input.storageLocationId}`;
  throw new Error(
    `Cannot sell "${productLabel}" from "${locationLabel}" — this location holds ${breakdown.unsellableQty.toString()} kg unsellable stock. Choose another location or reclassify stock first.`,
  );
}

/** Ensures sellable on-hand at a bin covers the requested POS quantity. */
export async function assertPosSellableQtyAvailable(
  db: Db,
  input: {
    salesPointId: number;
    storageLocationId: number;
    productId: number;
    qty: Prisma.Decimal | string | number;
    productName?: string;
    storageLocationName?: string;
    salesPointName?: string;
  },
): Promise<void> {
  const requested = dec(input.qty);
  if (requested.lte(0)) return;

  await assertPosLocationSellable(db, input);

  const breakdown = await getLocationStockBreakdown(
    db,
    input.salesPointId,
    input.storageLocationId,
    input.productId,
  );
  if (breakdown.sellableQty.gte(requested)) return;

  const [product, location, salesPoint] = await Promise.all([
    input.productName
      ? Promise.resolve({ productName: input.productName })
      : db.product.findUnique({
          where: { productId: input.productId },
          select: { productName: true },
        }),
    input.storageLocationName
      ? Promise.resolve({ name: input.storageLocationName })
      : db.storageLocation.findUnique({
          where: { id: input.storageLocationId },
          select: { name: true },
        }),
    input.salesPointName
      ? Promise.resolve({ name: input.salesPointName })
      : db.salesPoint.findUnique({
          where: { id: input.salesPointId },
          select: { name: true },
        }),
  ]);

  throw new InsufficientStockError({
    salesPointId: input.salesPointId,
    productId: input.productId,
    productLabel: product?.productName ?? `Product ${input.productId}`,
    salesPointLabel: salesPoint?.name ?? `Sales point ${input.salesPointId}`,
    storageLocationLabel: location?.name ?? `Location ${input.storageLocationId}`,
    condition: StockCondition.SELLABLE,
    requested: requested.toString(),
    available: breakdown.sellableQty.toString(),
  });
}
