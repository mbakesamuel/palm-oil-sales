"use server";

import { getPrismaClient } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const paths = ["/product-categories", "/products", "/pos", "/delivery-orders"];

function revalidateAll() {
  for (const p of paths) revalidatePath(p);
}

export async function createProductCat(formData: FormData) {
  const prisma = getPrismaClient();
  const productCat = String(formData.get("productCat") ?? "").trim();
  const productCode = String(formData.get("productCode") ?? "").trim();

  if (!productCat) throw new Error("Category name is required.");
  if (!productCode) throw new Error("Category code is required.");

  await prisma.productCat.create({
    data: { productCat, productCode },
  });

  revalidateAll();
}

export async function updateProductCat(formData: FormData) {
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("productCatId") ?? "").trim();
  const productCat = String(formData.get("productCat") ?? "").trim();
  const productCode = String(formData.get("productCode") ?? "").trim();
  const productCatId = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(productCatId)) throw new Error("Invalid category.");
  if (!productCat) throw new Error("Category name is required.");
  if (!productCode) throw new Error("Category code is required.");

  await prisma.productCat.update({
    where: { productCatId },
    data: { productCat, productCode },
  });

  revalidateAll();
}

export async function saveProductCat(formData: FormData) {
  const idRaw = String(formData.get("productCatId") ?? "").trim();
  if (idRaw) return updateProductCat(formData);
  return createProductCat(formData);
}

export async function deleteProductCat(formData: FormData) {
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("productCatId") ?? "").trim();
  const productCatId = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(productCatId)) throw new Error("Invalid category.");

  const n = await prisma.product.count({ where: { productCatId } });
  if (n > 0) {
    throw new Error("Cannot delete a category that still has products. Reassign or remove those products first.");
  }

  await prisma.productCat.delete({ where: { productCatId } });
  revalidateAll();
}
