"use server";

/** @deprecated Product variants removed — each bottled SKU is its own product on /products. */

export async function saveBpoVariant(_formData: FormData) {
  throw new Error("Product variants are no longer used. Create bottled products under Products.");
}

export async function deleteBpoVariant(_formData: FormData) {
  throw new Error("Product variants are no longer used. Manage products under Products.");
}

export async function saveBpoVariantPrice(_formData: FormData) {
  throw new Error("Bottled prices are managed under Setup → Product pricing.");
}

export async function deleteBpoVariantPrice(_formData: FormData) {
  throw new Error("Bottled prices are managed under Setup → Product pricing.");
}
