/**
 * Whether a product category drives customer-type-segmented pricing.
 *
 * Historically this was a hard-coded numeric id (`MAIN_PRODUCT_CATEGORY_ID = 1`).
 * It is now stored on `ProductCat.isMain` with a partial unique index ensuring
 * at most one Main category exists per environment. New code should branch on
 * the flag (or use the helpers below), not on the row id.
 */

/**
 * Returns true when the given product (or its category) is classified as the
 * customer-type-segmented "Main" category. Accepts either the full product
 * shape (with `productCat.isMain`) or a bare category object.
 */
export function isMainCategoryProduct(
  product: { productCat?: { isMain: boolean } | null } | null | undefined,
): boolean {
  return Boolean(product?.productCat?.isMain);
}

export function isMainCategory(
  category: { isMain: boolean } | null | undefined,
): boolean {
  return Boolean(category?.isMain);
}
