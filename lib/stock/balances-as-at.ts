import "server-only";

import { Prisma, StockCondition } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  utcInstantAfterIsoDate,
  utcIsoDateToday,
} from "@/lib/posting-calendar";
import {
  movementSignedDelta,
  type AdjustmentLineForDelta,
} from "@/lib/stock/movement-signed-delta";

const z = new Prisma.Decimal(0);

export type BalanceAsAtKey = {
  salesPointId: number;
  productId: number;
  storageLocationId: number;
  condition: StockCondition;
};

export type BalanceAsAtRow = BalanceAsAtKey & { qty: Prisma.Decimal };

function balanceKey(k: BalanceAsAtKey): string {
  return `${k.salesPointId}:${k.productId}:${k.storageLocationId}:${k.condition}`;
}

function parseKey(key: string): BalanceAsAtKey {
  const [salesPointId, productId, storageLocationId, condition] = key.split(":");
  return {
    salesPointId: Number(salesPointId),
    productId: Number(productId),
    storageLocationId: Number(storageLocationId),
    condition: condition as StockCondition,
  };
}

export async function loadPositiveBalancesAsAt(args: {
  salesPointId?: number | null;
  asAtIso: string | null;
}): Promise<BalanceAsAtRow[]> {
  const prisma = getPrismaClient();
  const scope =
    args.salesPointId != null ? { salesPointId: args.salesPointId } : {};

  const isLive =
    args.asAtIso == null ||
    args.asAtIso.trim() === "" ||
    args.asAtIso === utcIsoDateToday();

  if (isLive) {
    const rows = await prismaRetry(() =>
      prisma.stockBalance.findMany({
        where: {
          ...scope,
          qty: { gt: z },
          condition: {
            in: [StockCondition.SELLABLE, StockCondition.UNSELLABLE],
          },
        },
        select: {
          salesPointId: true,
          productId: true,
          storageLocationId: true,
          condition: true,
          qty: true,
        },
      }),
    );
    return rows.map((r) => ({
      salesPointId: r.salesPointId,
      productId: r.productId,
      storageLocationId: r.storageLocationId,
      condition: r.condition,
      qty: r.qty,
    }));
  }

  const asAtIso = args.asAtIso!.trim();
  /** Exclusive end: all movements on or before `asAtIso` (UTC calendar day). */
  const occurredBefore = utcInstantAfterIsoDate(asAtIso);

  const movements = await prismaRetry(() =>
    prisma.stockMovement.findMany({
      where: {
        ...scope,
        occurredAt: { lt: occurredBefore },
        condition: {
          in: [StockCondition.SELLABLE, StockCondition.UNSELLABLE],
        },
      },
      select: {
        salesPointId: true,
        productId: true,
        storageLocationId: true,
        condition: true,
        kind: true,
        qty: true,
        sourceKind: true,
        sourceId: true,
        notes: true,
      },
    }),
  );

  const adjustmentSourceIds = [
    ...new Set(
      movements
        .filter(
          (m) => m.kind === "ADJUSTMENT" && m.sourceKind === "ADJUSTMENT",
        )
        .map((m) => m.sourceId),
    ),
  ];

  const adjustmentLines =
    adjustmentSourceIds.length > 0
      ? await prismaRetry(() =>
          prisma.stockAdjustmentLine.findMany({
            where: {
              adjustmentId: { in: adjustmentSourceIds },
              adjustment: {
                status: "POSTED",
                occurredAt: { lt: occurredBefore },
              },
            },
            select: {
              adjustmentId: true,
              productId: true,
              storageLocationId: true,
              deltaQty: true,
              fromCondition: true,
              toCondition: true,
            },
          }),
        )
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

  const qtyByKey = new Map<string, Prisma.Decimal>();
  for (const m of movements) {
    const signed = movementSignedDelta(m, linesByAdjustmentId);
    if (signed.eq(0)) continue;
    const key = balanceKey(m);
    qtyByKey.set(key, (qtyByKey.get(key) ?? z).add(signed));
  }

  const out: BalanceAsAtRow[] = [];
  for (const [key, qty] of qtyByKey.entries()) {
    if (qty.gt(0)) {
      out.push({ ...parseKey(key), qty });
    }
  }

  return out;
}
