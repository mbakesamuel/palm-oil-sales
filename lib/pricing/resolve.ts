import "server-only";

import type { CustomerType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { MAIN_PRODUCT_CATEGORY_ID } from "@/lib/pricing/constants";

export type PrismaForPricing = ReturnType<typeof getPrismaClient>;

/**
 * Latest schedule row with effectiveFrom <= transaction calendar day (UTC), same idea as tax rates.
 */
export async function resolveUnitPriceExTax(
  prisma: PrismaForPricing,
  productId: number,
  customerType: CustomerType,
  asOfDate: Date,
): Promise<
  | { ok: true; unitPriceExTax: Prisma.Decimal; productName: string }
  | { ok: false; error: string }
> {

  const dayIso = prismaDateToIso(asOfDate);
  const asOfStartUtc = new Date(`${dayIso}T00:00:00.000Z`);

  const product = await prisma.product.findUnique({
    where: { productId },
    select: { productName: true, productCatId: true },
  });
  
  if (!product) {
    return { ok: false, error: `Product ${productId} was not found.` };
  }

  const isMainCategory = product.productCatId === MAIN_PRODUCT_CATEGORY_ID;

  const row = await prisma.productUnitPriceSchedule.findFirst({
    where: {
      productId,
      effectiveFrom: { lte: asOfStartUtc },
      ...(isMainCategory
        ? { customerType }
        : { customerType: null }),
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!row) {
    if (isMainCategory) {
      return {
        ok: false,
        error: `No unit price scheduled for "${product.productName}" (${customerType}) on or before ${dayIso}. Add a price in Product pricing (setup).`,
      };
    }
    return {
      ok: false,
      error: `No unit price scheduled for "${product.productName}" on or before ${dayIso}. Add a direct price in Product pricing (setup).`,
    };
  }

  return {
    ok: true,
    unitPriceExTax: row.unitPriceExTax,
    productName: product.productName,
  };
}
