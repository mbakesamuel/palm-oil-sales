import "server-only";

import type { CustomerType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { MAIN_PRODUCT_CATEGORY_ID } from "@/lib/pricing/constants";

export type PrismaForPricing = ReturnType<typeof getPrismaClient>;

/**
 * Latest schedule row with effectiveFrom <= transaction calendar day (UTC).
 * Bottled products use a single direct price (customerType null).
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
    select: { productName: true, productCatId: true, form: true },
  });

  if (!product) {
    return { ok: false, error: `Product ${productId} was not found.` };
  }

  const isMainCategory = product.productCatId === MAIN_PRODUCT_CATEGORY_ID;
  const isBottled = product.form === "BOTTLED";

  const row = await prisma.productUnitPriceSchedule.findFirst({
    where: {
      productId,
      effectiveFrom: { lte: asOfStartUtc },
      ...(isBottled
        ? { customerType: null }
        : isMainCategory
          ? { customerType }
          : { customerType: null }),
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (!row) {
    if (isBottled) {
      return {
        ok: false,
        error: `No unit price scheduled for "${product.productName}" on or before ${dayIso}. Add a price in Product pricing (setup).`,
      };
    }
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

/** Bottled BPO sales: tax-inclusive price from direct schedule row. */
export async function resolveBottledUnitPriceExTax(
  prisma: PrismaForPricing,
  productId: number,
  asOfDate: Date,
): Promise<
  | { ok: true; unitPriceExTax: Prisma.Decimal; productName: string; productId: number }
  | { ok: false; error: string }
> {
  const product = await prisma.product.findUnique({
    where: { productId },
    select: { productName: true, form: true },
  });
  if (!product) return { ok: false, error: "Product not found." };
  if (product.form !== "BOTTLED") {
    return { ok: false, error: "Product is not a bottled SKU." };
  }
  const r = await resolveUnitPriceExTax(
    prisma,
    productId,
    "RETAIL" as CustomerType,
    asOfDate,
  );
  if (!r.ok) return r;
  return { ok: true, unitPriceExTax: r.unitPriceExTax, productName: r.productName, productId };
}

/** @deprecated Use resolveBottledUnitPriceExTax(productId) — variants removed. */
export async function resolveVariantUnitPriceExTax(
  prisma: PrismaForPricing,
  productIdOrLegacyVariantId: string,
  asOfDate: Date,
): Promise<
  | {
      ok: true;
      unitPriceExTax: Prisma.Decimal;
      productName: string;
      variantName: string;
      productId: number;
    }
  | { ok: false; error: string }
> {
  const asNum = Number.parseInt(productIdOrLegacyVariantId, 10);
  if (Number.isFinite(asNum)) {
    const r = await resolveBottledUnitPriceExTax(prisma, asNum, asOfDate);
    if (!r.ok) return r;
    return {
      ok: true,
      unitPriceExTax: r.unitPriceExTax,
      productName: r.productName,
      variantName: r.productName,
      productId: r.productId,
    };
  }
  return { ok: false, error: "Select a bottled product." };
}
