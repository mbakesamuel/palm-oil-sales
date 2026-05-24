import "server-only";

import {
  Prisma,
  StockMovementStatus,
  StockMovementType,
  type StockUom,
} from "@prisma/client";
import type { StockItemKey } from "@/lib/stock-item-key";
import { stockItemKeyFromProduct, stockItemKeyLabel } from "@/lib/stock-item-key";

export class StockInsufficientError extends Error {
  override name = "StockInsufficientError";
  constructor(message: string) {
    super(message);
  }
}

/** @deprecated Use StockInsufficientError */
export { StockInsufficientError as BpoStockInsufficientError };

const z = new Prisma.Decimal(0);

export type DeductionLine = {
  stockItem: StockItemKey;
  qty: Prisma.Decimal;
  label: string;
  saleLineId?: string;
  stockMovementLineId?: string;
};

function itemKey(productId: number): string {
  return String(productId);
}

export async function sumOnHand(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  item: StockItemKey,
): Promise<Prisma.Decimal> {
  const lots = await tx.stockLot.findMany({
    where: {
      salesPointId,
      productId: item.productId,
      qtyRemaining: { gt: 0 },
    },
    select: { qtyRemaining: true },
  });
  return lots.reduce((acc, l) => acc.add(l.qtyRemaining), z);
}

export async function sumDraftTransferReserve(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  item: StockItemKey,
  excludeMovementId?: string,
): Promise<Prisma.Decimal> {
  const lines = await tx.stockMovementLine.findMany({
    where: {
      productId: item.productId,
      movement: {
        movementType: StockMovementType.TRANSFER,
        status: StockMovementStatus.DRAFT,
        sourceSalesPointId: salesPointId,
        ...(excludeMovementId ? { id: { not: excludeMovementId } } : {}),
      },
    },
    select: { voucherQty: true },
  });
  return lines.reduce((acc, l) => acc.add(l.voucherQty), z);
}

export async function getAvailableStock(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  item: StockItemKey,
  excludeMovementId?: string,
): Promise<Prisma.Decimal> {
  const onHand = await sumOnHand(tx, salesPointId, item);
  const reserved = await sumDraftTransferReserve(tx, salesPointId, item, excludeMovementId);
  const available = onHand.sub(reserved);
  return available.lt(0) ? z : available;
}

export async function assertAvailableForTransfer(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  lines: Array<{ item: StockItemKey; qty: Prisma.Decimal; label: string }>,
  excludeMovementId?: string,
): Promise<void> {
  const needByItem = new Map<string, { item: StockItemKey; qty: Prisma.Decimal; label: string }>();
  for (const line of lines) {
    const k = itemKey(line.item.productId);
    const prev = needByItem.get(k);
    if (prev) {
      needByItem.set(k, { ...prev, qty: prev.qty.add(line.qty) });
    } else {
      needByItem.set(k, { ...line });
    }
  }
  for (const { item, qty, label } of needByItem.values()) {
    if (qty.lte(0)) continue;
    const available = await getAvailableStock(tx, salesPointId, item, excludeMovementId);
    if (available.lt(qty)) {
      const short = qty.sub(available).toDecimalPlaces(3);
      throw new StockInsufficientError(
        `Insufficient stock for ${label} (short by ${short.toString()}).`,
      );
    }
  }
}

export async function applyFefoDeduction(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  lines: DeductionLine[],
): Promise<void> {
  if (lines.length === 0) return;

  const productIds = [...new Set(lines.map((l) => l.stockItem.productId))];

  const lots = await tx.stockLot.findMany({
    where: {
      salesPointId,
      qtyRemaining: { gt: 0 },
      productId: { in: productIds },
    },
    orderBy: [{ productId: "asc" }, { receivedAt: "asc" }],
  });

  const remaining = new Map<string, Prisma.Decimal>();
  const pools = new Map<number, typeof lots>();
  for (const lot of lots) {
    remaining.set(lot.id, new Prisma.Decimal(lot.qtyRemaining));
    const arr = pools.get(lot.productId) ?? [];
    arr.push(lot);
    pools.set(lot.productId, arr);
  }

  const allocations: Array<{
    stockLotId: string;
    qty: Prisma.Decimal;
    saleLineId?: string;
    stockMovementLineId?: string;
  }> = [];

  for (const line of lines) {
    let need = new Prisma.Decimal(line.qty);
    if (need.lte(0)) continue;
    const pool = pools.get(line.stockItem.productId) ?? [];
    for (const lot of pool) {
      if (need.lte(0)) break;
      const rem = remaining.get(lot.id);
      if (!rem || rem.lte(0)) continue;
      const take = need.lt(rem) ? need : rem;
      allocations.push({
        stockLotId: lot.id,
        qty: take,
        saleLineId: line.saleLineId,
        stockMovementLineId: line.stockMovementLineId,
      });
      remaining.set(lot.id, rem.sub(take));
      need = need.sub(take);
    }
    if (need.gt(0)) {
      throw new StockInsufficientError(
        `Insufficient stock for ${line.label} at this sales point (short by ${need.toDecimalPlaces(3).toString()}).`,
      );
    }
  }

  const decrementByLot = new Map<string, Prisma.Decimal>();
  for (const a of allocations) {
    decrementByLot.set(a.stockLotId, (decrementByLot.get(a.stockLotId) ?? z).add(a.qty));
  }
  for (const [stockLotId, dec] of decrementByLot) {
    await tx.stockLot.update({
      where: { id: stockLotId },
      data: { qtyRemaining: { decrement: dec } },
    });
  }
  for (const a of allocations) {
    await tx.stockAllocation.create({
      data: {
        stockLotId: a.stockLotId,
        qty: a.qty,
        saleLineId: a.saleLineId ?? null,
        stockMovementLineId: a.stockMovementLineId ?? null,
      },
    });
  }
}

export async function restoreToLots(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  lines: DeductionLine[],
): Promise<void> {
  for (const line of lines) {
    if (line.qty.lte(0)) continue;
    let left = new Prisma.Decimal(line.qty);
    const lots = await tx.stockLot.findMany({
      where: {
        salesPointId,
        productId: line.stockItem.productId,
      },
      orderBy: { receivedAt: "desc" },
    });
    for (const lot of lots) {
      if (left.lte(0)) break;
      const cap = new Prisma.Decimal(lot.qtyReceived).sub(lot.qtyRemaining);
      if (cap.lte(0)) continue;
      const add = left.lt(cap) ? left : cap;
      await tx.stockLot.update({
        where: { id: lot.id },
        data: { qtyRemaining: { increment: add } },
      });
      left = left.sub(add);
    }
    if (left.gt(0)) {
      const last = lots[0];
      if (last) {
        await tx.stockLot.update({
          where: { id: last.id },
          data: { qtyRemaining: { increment: left } },
        });
      } else {
        throw new StockInsufficientError(`Cannot restore stock for ${line.label}.`);
      }
    }
  }
}

export async function postTransferSenderValidation(
  tx: Prisma.TransactionClient,
  movementId: string,
): Promise<void> {
  const movement = await tx.stockMovement.findUnique({
    where: { id: movementId },
    include: {
      lines: {
        include: {
          product: { select: { productName: true } },
        },
      },
    },
  });
  if (!movement) throw new Error("Movement not found.");
  if (movement.movementType !== StockMovementType.TRANSFER) {
    throw new Error("Not a transfer movement.");
  }
  if (movement.status !== StockMovementStatus.DRAFT) {
    throw new Error("Transfer is not in draft status.");
  }
  if (movement.sourceSalesPointId == null) {
    throw new Error("Transfer has no source sales point.");
  }

  const deductLines: DeductionLine[] = movement.lines.map((line) => ({
    stockItem: stockItemKeyFromProduct(line.productId),
    qty: line.voucherQty,
    label: stockItemKeyLabel(stockItemKeyFromProduct(line.productId), line.product.productName),
    stockMovementLineId: line.id,
  }));

  await assertAvailableForTransfer(
    tx,
    movement.sourceSalesPointId,
    deductLines.map((l) => ({ item: l.stockItem, qty: l.qty, label: l.label })),
    movementId,
  );

  await applyFefoDeduction(tx, movement.sourceSalesPointId, deductLines);
}

export async function postTransferReceiverValidation(
  tx: Prisma.TransactionClient,
  movementId: string,
  actualQtyByLineId: Map<string, Prisma.Decimal>,
): Promise<void> {
  const movement = await tx.stockMovement.findUnique({
    where: { id: movementId },
    include: {
      lines: {
        include: {
          product: { select: { productName: true, form: true } },
        },
      },
    },
  });
  if (!movement) throw new Error("Movement not found.");
  if (movement.movementType !== StockMovementType.TRANSFER) {
    throw new Error("Not a transfer movement.");
  }
  if (movement.status !== StockMovementStatus.SENDER_VALIDATED) {
    throw new Error("Transfer must be sender-validated first.");
  }
  if (movement.destinationSalesPointId == null) {
    throw new Error("Transfer has no destination sales point.");
  }

  const sourceId = movement.sourceSalesPointId!;

  for (const line of movement.lines) {
    const actual = actualQtyByLineId.get(line.id) ?? line.voucherQty;
    const posted = actual;
    if (posted.gt(line.voucherQty)) {
      throw new Error("Received quantity cannot exceed voucher quantity.");
    }

    if (posted.lt(line.voucherQty)) {
      const restoreQty = line.voucherQty.sub(posted);
      await restoreToLots(tx, sourceId, [
        {
          stockItem: stockItemKeyFromProduct(line.productId),
          qty: restoreQty,
          label: stockItemKeyLabel(
            stockItemKeyFromProduct(line.productId),
            line.product.productName,
          ),
        },
      ]);
    }

    if (posted.gt(0)) {
      const uom: StockUom = line.product.form === "BOTTLED" ? "UNIT" : "KG";
      await tx.stockLot.create({
        data: {
          salesPointId: movement.destinationSalesPointId,
          storageLocationId: null,
          productId: line.productId,
          uom,
          qtyReceived: posted,
          qtyRemaining: posted,
          receivedAt: new Date(),
          sourceMovementLineId: line.id,
        },
      });
    }

    await tx.stockMovementLine.update({
      where: { id: line.id },
      data: { actualQty: actual, postedQty: posted },
    });
  }
}

export async function reverseTransferSenderPosting(
  tx: Prisma.TransactionClient,
  movementId: string,
): Promise<void> {
  const movement = await tx.stockMovement.findUnique({
    where: { id: movementId },
    include: {
      lines: {
        include: {
          allocations: true,
        },
      },
    },
  });
  if (!movement?.sourceSalesPointId) throw new Error("Movement not found.");
  if (movement.status !== StockMovementStatus.SENDER_VALIDATED) {
    throw new Error("Can only reverse sender posting for sender-validated transfers.");
  }

  for (const line of movement.lines) {
    for (const alloc of line.allocations) {
      await tx.stockLot.update({
        where: { id: alloc.stockLotId },
        data: { qtyRemaining: { increment: alloc.qty } },
      });
      await tx.stockAllocation.delete({ where: { id: alloc.id } });
    }
  }
}

/** Sale lines: loose kg */
export type SaleLineForStock = {
  id: string;
  productId: number;
  qtyKg: Prisma.Decimal;
  product: { productName: string };
};

/** Sale lines: bottled units (one product per SKU) */
export type SaleLineForUnitStock = {
  id: string;
  productId: number;
  qtyUnits: Prisma.Decimal;
  product: { productName: string };
};

export async function saleStockIsFullyReserved(
  tx: Prisma.TransactionClient,
  bulkLines: SaleLineForStock[],
  unitLines: SaleLineForUnitStock[],
): Promise<boolean> {
  const lineIds = [...bulkLines.map((l) => l.id), ...unitLines.map((l) => l.id)];
  if (lineIds.length === 0) return false;

  const rows = await tx.saleLine.findMany({
    where: { id: { in: lineIds } },
    include: { stockAllocations: { select: { qty: true } } },
  });
  if (rows.length !== lineIds.length) return false;

  const bulkById = new Map(bulkLines.map((l) => [l.id, l.qtyKg]));
  const unitById = new Map(unitLines.map((l) => [l.id, l.qtyUnits]));

  for (const row of rows) {
    const required = bulkById.get(row.id) ?? unitById.get(row.id);
    if (!required || required.lte(0)) continue;
    const allocated = row.stockAllocations.reduce(
      (acc: Prisma.Decimal, a: { qty: Prisma.Decimal }) => acc.add(a.qty),
      z,
    );
    if (allocated.lt(required)) return false;
  }
  return true;
}

/** Restore lot quantities from sale-line allocations (e.g. when deleting a pending invoice). */
export async function releaseSaleStockAllocations(
  tx: Prisma.TransactionClient,
  saleId: string,
): Promise<void> {
  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    include: {
      lines: {
        include: { stockAllocations: true },
      },
    },
  });
  if (!sale) throw new Error("Sale not found.");

  for (const line of sale.lines) {
    for (const alloc of line.stockAllocations) {
      await tx.stockLot.update({
        where: { id: alloc.stockLotId },
        data: { qtyRemaining: { increment: alloc.qty } },
      });
      await tx.stockAllocation.delete({ where: { id: alloc.id } });
    }
  }
}

export async function applySaleStockDeduction(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  bulkLines: SaleLineForStock[],
  unitLines: SaleLineForUnitStock[],
): Promise<void> {
  const deduct: DeductionLine[] = [
    ...bulkLines.map((l) => ({
      stockItem: stockItemKeyFromProduct(l.productId),
      qty: l.qtyKg,
      label: l.product.productName,
      saleLineId: l.id,
    })),
    ...unitLines.map((l) => ({
      stockItem: stockItemKeyFromProduct(l.productId),
      qty: l.qtyUnits,
      label: l.product.productName,
      saleLineId: l.id,
    })),
  ];

  for (const line of deduct) {
    const available = await getAvailableStock(tx, salesPointId, line.stockItem);
    if (available.lt(line.qty)) {
      throw new StockInsufficientError(
        `Insufficient stock for ${line.label} at this sales point (short by ${line.qty.sub(available).toDecimalPlaces(3).toString()}).`,
      );
    }
  }

  await applyFefoDeduction(tx, salesPointId, deduct);
}

/** @deprecated */
export async function applyFefoStockDeduction(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  lines: SaleLineForStock[],
): Promise<void> {
  await applySaleStockDeduction(tx, salesPointId, lines, []);
}

export type BpoStockLine = {
  productId: number;
  qtyUnits: Prisma.Decimal;
  label: string;
  saleLineId?: string;
};

export async function applyBpoStockDeduction(
  tx: Prisma.TransactionClient,
  salesPointId: number,
  lines: BpoStockLine[],
): Promise<void> {
  const unitLines: SaleLineForUnitStock[] = lines
    .filter((l) => l.saleLineId)
    .map((l) => ({
      id: l.saleLineId!,
      productId: l.productId,
      qtyUnits: l.qtyUnits,
      product: { productName: l.label },
    }));
  const movementOnly: DeductionLine[] = lines
    .filter((l) => !l.saleLineId)
    .map((l) => ({
      stockItem: stockItemKeyFromProduct(l.productId),
      qty: l.qtyUnits,
      label: l.label,
    }));
  if (unitLines.length > 0) {
    await applySaleStockDeduction(tx, salesPointId, [], unitLines);
  }
  if (movementOnly.length > 0) {
    await applyFefoDeduction(tx, salesPointId, movementOnly);
  }
}
