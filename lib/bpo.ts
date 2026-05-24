import "server-only";

import { Prisma } from "@prisma/client";
import { isBottledForm } from "@/lib/product-form";

export const BPO_PRODUCT_LABEL = "Bottled Palm Oil";
export const BOTA_SALES_POINT_NAME = "Bota";

export {
  StockInsufficientError as BpoStockInsufficientError,
  applyBpoStockDeduction,
} from "@/lib/stock-ledger";

export {
  getHubSalesPointId as getBotaSalesPointId,
  ensureHubSalesPointId as ensureBotaSalesPointId,
  HUB_SALES_POINT_NAME,
} from "@/lib/stock-policy";

export type BpoStockLine = {
  productId: number;
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

export async function isBottledPalmOilProduct(
  prisma: {
    product: {
      findUnique: (args: {
        where: { productId: number };
        select: { form: true };
      }) => Promise<{ form: import("@prisma/client").ProductForm } | null>;
    };
  },
  productId: number,
): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { productId },
    select: { form: true },
  });
  if (!product) return false;
  return isBottledForm(product.form);
}
