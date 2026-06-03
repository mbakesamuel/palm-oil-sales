import "server-only";

import {
  Prisma,
  StockCondition,
  StockMovementKind,
  ValidationStatus,
  type PosSaleProductMode,
} from "@prisma/client";
import { deliveryOrderPosUsageError } from "@/lib/delivery-order-sale-control";
import { isInsufficientStockError } from "@/lib/stock/errors";
import { assertPosLocationSellable } from "@/lib/stock/pos-location";
import { applyMovement } from "@/lib/stock/post";
import { resolveDefaultStorageLocationId } from "@/lib/stock/storage-location";
import { effectiveSaleProductMode, isBottleSaleMode } from "@/lib/pos/sale-product-mode";

export type SaleForValidation = {
  id: string;
  status: ValidationStatus;
  salesPointId: number | null;
  deliveryOrderNo: string | null;
  saleProductMode: PosSaleProductMode | null;
  soldAt: Date;
  lines: Array<{
    productId: number;
    storageLocationId: number | null;
    qtyKg: Prisma.Decimal;
    qtyUnits: Prisma.Decimal | null;
    product: { productCat: { isBottled: boolean } | null };
  }>;
};

export async function validatePosSaleInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    sale: SaleForValidation;
    userId: string;
  },
): Promise<void> {
  const { sale, userId } = input;
  if (sale.status === ValidationStatus.VALIDATED) return;
  if (sale.salesPointId == null) {
    throw new Error("This invoice has no sales point; cannot deduct stock on validation.");
  }

  const mode = effectiveSaleProductMode(sale.saleProductMode);
  const stockSalesPointId = sale.salesPointId;

  if (isBottleSaleMode(mode)) {
    if (!sale.deliveryOrderNo) {
      /* bottle sales: delivery order not required */
    } else {
      const linkedDo = await tx.deliveryOrder.findUnique({
        where: { deliveryOrderNo: sale.deliveryOrderNo },
        select: { status: true },
      });
      const doStatusErr = deliveryOrderPosUsageError(linkedDo?.status);
      if (doStatusErr) throw new Error(doStatusErr);
    }
  } else {
    if (!sale.deliveryOrderNo) {
      throw new Error("Delivery Order number is required.");
    }
    const linkedDo = await tx.deliveryOrder.findUnique({
      where: { deliveryOrderNo: sale.deliveryOrderNo },
      select: { status: true },
    });
    const doStatusErr = deliveryOrderPosUsageError(linkedDo?.status);
    if (doStatusErr) throw new Error(doStatusErr);
  }

  for (const line of sale.lines) {
    const storageLocationId =
      line.storageLocationId ??
      (await resolveDefaultStorageLocationId(tx, stockSalesPointId));
    await assertPosLocationSellable(tx, {
      salesPointId: stockSalesPointId,
      storageLocationId,
      productId: line.productId,
    });
    const qty = line.product.productCat?.isBottled
      ? (line.qtyUnits ?? line.qtyKg)
      : line.qtyKg;
    if (new Prisma.Decimal(qty).lte(0)) continue;
    await applyMovement(tx, {
      salesPointId: stockSalesPointId,
      productId: line.productId,
      storageLocationId,
      condition: StockCondition.SELLABLE,
      qty,
      kind: StockMovementKind.SALE,
      occurredAt: sale.soldAt,
      userId,
      sourceKind: "SALE",
      sourceId: sale.id,
    });
  }

  await tx.sale.update({
    where: { id: sale.id },
    data: {
      status: ValidationStatus.VALIDATED,
      validatedAt: new Date(),
      validatedByUserId: userId,
    },
  });
}

type PrismaTransactional = {
  $transaction: <T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    opts?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ) => Promise<T>;
};

export async function runValidatePosSale(
  prisma: PrismaTransactional,
  sale: SaleForValidation,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await validatePosSaleInTransaction(tx, { sale, userId });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { ok: true };
  } catch (e) {
    if (isInsufficientStockError(e)) {
      return { ok: false, error: e.message };
    }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not validate sale.",
    };
  }
}
