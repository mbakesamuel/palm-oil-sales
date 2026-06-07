import "server-only";

import { Prisma } from "@prisma/client";
import { getCustomerTypeIdByCode } from "@/lib/customer-types/catalog";
import { getPrismaClient } from "@/lib/prisma";
import { prismaDateToIso } from "@/lib/posting-calendar";

export type PrismaForPricing = ReturnType<typeof getPrismaClient>;

/**
 * Latest schedule row with effectiveFrom <= transaction calendar day (UTC).
 * Bottled products use a single direct price (customerTypeId null).
 */
export async function resolveUnitPriceExTax(
  prisma: PrismaForPricing,
  productId: number,
  customerTypeId: string,
  asOfDate: Date,
): Promise<
  | { ok: true; unitPriceExTax: Prisma.Decimal; productName: string }
  | { ok: false; error: string }
> {
  const dayIso = prismaDateToIso(asOfDate);
  const asOfStartUtc = new Date(`${dayIso}T00:00:00.000Z`);

  const product = await prisma.product.findUnique({
    where: { productId },
    select: {
      productName: true,
      productCat: { select: { isMain: true, isBottled: true } },
    },
  });

  if (!product) {
    return { ok: false, error: `Product ${productId} was not found.` };
  }

  const isMainCategory = product.productCat?.isMain === true;
  const isBottled = product.productCat?.isBottled === true;

  const row = await prisma.productUnitPriceSchedule.findFirst({
    where: {
      productId,
      effectiveFrom: { lte: asOfStartUtc },
      ...(isBottled
        ? { customerTypeId: null }
        : isMainCategory
          ? { customerTypeId }
          : { customerTypeId: null }),
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
      const typeDef = await prisma.customerTypeDefinition.findUnique({
        where: { id: customerTypeId },
        select: { name: true, code: true },
      });
      const typeLabel = typeDef?.name ?? typeDef?.code ?? customerTypeId;
      return {
        ok: false,
        error: `No unit price scheduled for "${product.productName}" (${typeLabel}) on or before ${dayIso}. Add a price in Product pricing (setup).`,
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

/** Bottled (unit) SKUs: price from direct schedule row (retail segment). */
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
    select: {
      productName: true,
      productCat: { select: { isBottled: true } },
    },
  });
  if (!product) return { ok: false, error: "Product not found." };
  if (product.productCat?.isBottled !== true) {
    return { ok: false, error: "Product is not a bottled SKU." };
  }
  const retailTypeId = await getCustomerTypeIdByCode("RETAIL");
  if (!retailTypeId) {
    return { ok: false, error: "Retail customer type is not configured." };
  }
  const r = await resolveUnitPriceExTax(prisma, productId, retailTypeId, asOfDate);
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
