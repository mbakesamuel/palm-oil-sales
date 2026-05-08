import "server-only";

import { Prisma } from "@prisma/client";

export const BPO_PRODUCT_LABEL = "Bottled Palm Oil";
export const BOTA_SALES_POINT_NAME = "Bota";

export class BpoStockInsufficientError extends Error {
  override name = "BpoStockInsufficientError";
  constructor(message: string) {
    super(message);
  }
}

export type BpoStockLine = {
  productVariantId: string;
  qtyUnits: Prisma.Decimal;
  label: string;
  saleLineId?: string;
};

export function dQty(raw: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(String(raw).trim().replace(",", "."));
}

export function qty3(value: Prisma.Decimal) {
  return value.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
}

export function money2(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export async function getBotaSalesPointId(
  prisma: Prisma.TransactionClient | PrismaClientLike,
): Promise<number | null> {
  const bota = await prisma.salesPoint.findFirst({
    where: { name: { equals: BOTA_SALES_POINT_NAME, mode: "insensitive" } },
    select: { id: true },
  });
  return bota?.id ?? null;
}

export async function ensureBotaSalesPointId(
  prisma: Prisma.TransactionClient | PrismaClientLike,
): Promise<number> {
  const id = await getBotaSalesPointId(prisma);
  if (id == null) {
    throw new Error(`Create a sales point named "${BOTA_SALES_POINT_NAME}" before managing Bottled Palm Oil.`);
  }
  return id;
}

export async function isBottledPalmOilProduct(
  prisma: Prisma.TransactionClient | PrismaClientLike,
  productId: number,
): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { productId },
    select: { isBottledPalmOil: true },
  });
  return Boolean(product?.isBottledPalmOil);
}

export async function applyBpoStockDeduction(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  lines: BpoStockLine[],
): Promise<void> {
  const variantIds = [...new Set(lines.map((l) => l.productVariantId))];
  const batches = await tx.bpoStockBatch.findMany({
    where: {
      salesPointId,
      productVariantId: { in: variantIds },
      qtyRemainingUnits: { gt: 0 },
    },
    orderBy: [{ productVariantId: "asc" }, { receivedAt: "asc" }],
  });

  const remaining = new Map<string, Prisma.Decimal>();
  const byVariant = new Map<string, typeof batches>();
  for (const b of batches) {
    remaining.set(b.id, new Prisma.Decimal(b.qtyRemainingUnits));
    const arr = byVariant.get(b.productVariantId) ?? [];
    arr.push(b);
    byVariant.set(b.productVariantId, arr);
  }

  const allocations: Array<{
    saleLineId?: string;
    batchId: string;
    productVariantId: string;
    qtyUnits: Prisma.Decimal;
  }> = [];

  for (const line of lines) {
    let need = new Prisma.Decimal(line.qtyUnits);
    if (need.lte(0)) continue;
    const pool = byVariant.get(line.productVariantId) ?? [];
    for (const b of pool) {
      if (need.lte(0)) break;
      const rem = remaining.get(b.id);
      if (!rem || rem.lte(0)) continue;
      const take = need.lt(rem) ? need : rem;
      allocations.push({
        saleLineId: line.saleLineId,
        batchId: b.id,
        productVariantId: line.productVariantId,
        qtyUnits: take,
      });
      remaining.set(b.id, rem.sub(take));
      need = need.sub(take);
    }
    if (need.gt(0)) {
      throw new BpoStockInsufficientError(
        `Insufficient Bottled Palm Oil stock for ${line.label} at this sales point (short by ${need.toDecimalPlaces(3).toString()} units).`,
      );
    }
  }

  const decrementByBatch = new Map<string, Prisma.Decimal>();
  for (const a of allocations) {
    decrementByBatch.set(a.batchId, (decrementByBatch.get(a.batchId) ?? new Prisma.Decimal(0)).add(a.qtyUnits));
  }

  for (const [batchId, dec] of decrementByBatch) {
    await tx.bpoStockBatch.update({
      where: { id: batchId },
      data: { qtyRemainingUnits: { decrement: dec } },
    });
  }

  for (const a of allocations) {
    if (!a.saleLineId) continue;
    await tx.bpoSaleLineBatchAllocation.create({
      data: {
        saleLineId: a.saleLineId,
        batchId: a.batchId,
        productVariantId: a.productVariantId,
        qtyUnits: a.qtyUnits,
      },
    });
  }
}

type PrismaClientLike = {
  salesPoint: {
    findFirst: (args: {
      where: { name: { equals: string; mode: "insensitive" } };
      select: { id: true };
    }) => Promise<{ id: number } | null>;
  };
  product: {
    findUnique: (args: {
      where: { productId: number };
      select: { isBottledPalmOil: true };
    }) => Promise<{ isBottledPalmOil: boolean } | null>;
  };
};
