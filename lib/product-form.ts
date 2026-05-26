import type { ProductForm, Prisma } from "@prisma/client";
import { ProductForm as ProductFormEnum } from "@prisma/client";

export const PRODUCT_FORM_OPTIONS: { value: ProductForm; label: string; hint: string }[] = [
  {
    value: "LOOSE",
    label: "Loose (bulk kg)",
    hint: "POS sales and delivery orders (kg).",
  },
  {
    value: "BOTTLED",
    label: "Bottled (units)",
    hint: "Variants and BPO sales (units).",
  },
  {
    value: "SECONDARY",
    label: "Secondary",
    hint: "Catalog only.",
  },
];

export function uomForProductForm(form: ProductForm): string {
  switch (form) {
    case "BOTTLED":
      return "Unit";
    case "LOOSE":
      return "Kg";
    default:
      return "Unit";
  }
}

export function productFormLabel(form: ProductForm): string {
  return PRODUCT_FORM_OPTIONS.find((o) => o.value === form)?.label ?? form;
}

export function parseProductForm(raw: string): ProductForm {
  const v = String(raw ?? "").trim().toUpperCase();
  if (v === "BOTTLED" || v === "LOOSE" || v === "SECONDARY") {
    return v as ProductForm;
  }
  return ProductFormEnum.LOOSE;
}

export function parseProductFormFromFormData(formData: FormData): ProductForm {
  return parseProductForm(String(formData.get("form") ?? ""));
}

export function isLooseForm(form: ProductForm): boolean {
  return form === "LOOSE";
}

export function isBottledForm(form: ProductForm): boolean {
  return form === "BOTTLED";
}

export function productWhereBottled(): Prisma.ProductWhereInput {
  return { form: "BOTTLED" };
}

export function productWhereNotBottled(): Prisma.ProductWhereInput {
  return { form: { not: "BOTTLED" } };
}
