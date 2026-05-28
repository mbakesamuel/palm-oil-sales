import "server-only";

import { Prisma } from "@prisma/client";

export const BPO_PRODUCT_LABEL = "Bottled Palm Oil";
export const BOTA_SALES_POINT_NAME = "Bota";

export async function getBotaSalesPointId(
  prisma: {
    salesPoint: {
      findFirst: (args: {
        where: { name: { equals: string; mode: "insensitive" } };
        select: { id: true };
      }) => Promise<{ id: number } | null>;
    };
  },
): Promise<number | null> {
  const hub = await prisma.salesPoint.findFirst({
    where: { name: { equals: BOTA_SALES_POINT_NAME, mode: "insensitive" } },
    select: { id: true },
  });
  return hub?.id ?? null;
}

export async function ensureBotaSalesPointId(
  prisma: Parameters<typeof getBotaSalesPointId>[0],
): Promise<number> {
  const id = await getBotaSalesPointId(prisma);
  if (id == null) {
    throw new Error(
      `Create a sales point named "${BOTA_SALES_POINT_NAME}" before posting bottled palm oil sales.`,
    );
  }
  return id;
}

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
        select: { productCat: { select: { isBottled: true } } };
      }) => Promise<{ productCat: { isBottled: boolean } | null } | null>;
    };
  },
  productId: number,
): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { productId },
    select: { productCat: { select: { isBottled: true } } },
  });
  return product?.productCat?.isBottled === true;
}
