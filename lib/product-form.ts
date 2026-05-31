import type { Prisma } from "@prisma/client";

/**
 * Category-classification helpers. The legacy per-product `Product.form` enum
 * (LOOSE / BOTTLED / SECONDARY) was dropped in
 * `20260526120000_drop_product_form_use_category_bottled` in favour of a
 * single `ProductCat.isBottled` flag. Bottled categories use unit UoM; bulk categories use kg.
 */

/** UoM defaults derived from a product's category. */
export function uomForCategory(
  category: { isBottled: boolean } | null | undefined,
): string {
  return category?.isBottled ? "Unit" : "Kg";
}

/** Convenience: takes the product directly (with the category eagerly loaded). */
export function uomForProduct(
  product: { productCat?: { isBottled: boolean } | null } | null | undefined,
): string {
  return uomForCategory(product?.productCat ?? null);
}

export function isBottledProduct(
  product: { productCat?: { isBottled: boolean } | null } | null | undefined,
): boolean {
  return Boolean(product?.productCat?.isBottled);
}

export function isLooseProduct(
  product: { productCat?: { isBottled: boolean } | null } | null | undefined,
): boolean {
  return !isBottledProduct(product);
}

/** Prisma WHERE filter: bottled (unit-priced) products only. */
export function productWhereBottled(): Prisma.ProductWhereInput {
  return { productCat: { isBottled: true } };
}

/** Prisma WHERE filter: bulk (kg) products only. */
export function productWhereNotBottled(): Prisma.ProductWhereInput {
  return { productCat: { isBottled: false } };
}
