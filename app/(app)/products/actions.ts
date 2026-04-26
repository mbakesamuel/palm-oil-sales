"use server";

import { getPrismaClient } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createProductCat(formData: FormData) {
  const prisma = getPrismaClient();
  const productCat = String(formData.get("productCat") ?? "").trim();
  const productCode = String(formData.get("productCode") ?? "").trim();

  if (!productCat) throw new Error("Category name is required.");
  if (!productCode) throw new Error("Category code is required.");

  await prisma.productCat.create({
    data: { productCat, productCode },
  });

  revalidatePath("/products");
  revalidatePath("/pos");
}

export async function createProduct(formData: FormData) {
  const prisma = getPrismaClient();
  const productName = String(formData.get("productName") ?? "").trim();
  const productCodeRaw = String(formData.get("productCode") ?? "").trim();
  const productCatIdRaw = String(formData.get("productCatId") ?? "").trim();

  if (!productName) throw new Error("Product name is required.");
  if (!productCatIdRaw) throw new Error("Category is required.");

  const productCatId = Number.parseInt(productCatIdRaw, 10);
  if (!Number.isFinite(productCatId)) throw new Error("Invalid category.");

  await prisma.product.create({
    data: {
      productName,
      productCode: productCodeRaw || null,
      productCatId,
    },
  });

  revalidatePath("/products");
  revalidatePath("/pos");
}

