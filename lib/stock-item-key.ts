import type { ProductForm, StockUom } from "@prisma/client";

export type StockItemKey = {
  productId: number;
};

export function stockItemKeyFromProduct(productId: number): StockItemKey {
  return { productId };
}

export function stockItemKeyLabel(key: StockItemKey, productName: string) {
  return productName;
}

export function itemKeyEquals(a: StockItemKey, b: StockItemKey): boolean {
  return a.productId === b.productId;
}

export function stockUomForForm(form: ProductForm): StockUom {
  return form === "BOTTLED" ? "UNIT" : "KG";
}
