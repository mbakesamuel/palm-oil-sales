"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const paths = [
  "/product-categories",
  "/products",
  "/pos",
  "/delivery-orders",
  "/setup/product-pricing",
];

function revalidateAll() {
  for (const p of paths) revalidatePath(p);
}

function readIsMain(formData: FormData): boolean {
  const raw = String(formData.get("isMain") ?? "").trim().toLowerCase();
  return raw === "on" || raw === "true" || raw === "1";
}

async function assertNoOtherMain(
  prisma: ReturnType<typeof getPrismaClient>,
  exceptId: number | null,
) {
  const other = await prisma.productCat.findFirst({
    where: {
      isMain: true,
      ...(exceptId != null ? { NOT: { productCatId: exceptId } } : {}),
    },
    select: { productCatId: true, productCat: true },
  });
  if (other) {
    throw new Error(
      `Another category (“${other.productCat}”) is already marked as Main. Clear that flag before marking a different category as Main.`,
    );
  }
}

export async function createProductCat(formData: FormData) {
  await assertPermissionKey("route:/product-categories");
  const prisma = getPrismaClient();
  const productCat = String(formData.get("productCat") ?? "").trim();
  const productCode = String(formData.get("productCode") ?? "").trim();
  const isMain = readIsMain(formData);

  if (!productCat) throw new Error("Category name is required.");
  if (!productCode) throw new Error("Category code is required.");

  if (isMain) await assertNoOtherMain(prisma, null);

  await prisma.productCat.create({
    data: { productCat, productCode, isMain },
  });

  revalidateAll();
}

export async function updateProductCat(formData: FormData) {
  await assertPermissionKey("route:/product-categories");
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("productCatId") ?? "").trim();
  const productCat = String(formData.get("productCat") ?? "").trim();
  const productCode = String(formData.get("productCode") ?? "").trim();
  const productCatId = Number.parseInt(idRaw, 10);
  const isMain = readIsMain(formData);
  if (!Number.isFinite(productCatId)) throw new Error("Invalid category.");
  if (!productCat) throw new Error("Category name is required.");
  if (!productCode) throw new Error("Category code is required.");

  if (isMain) await assertNoOtherMain(prisma, productCatId);

  await prisma.productCat.update({
    where: { productCatId },
    data: { productCat, productCode, isMain },
  });

  revalidateAll();
}

export async function saveProductCat(formData: FormData) {
  await assertPermissionKey("route:/product-categories");
  const idRaw = String(formData.get("productCatId") ?? "").trim();
  if (idRaw) return updateProductCat(formData);
  return createProductCat(formData);
}

export async function deleteProductCat(formData: FormData) {
  await assertPermissionKey("route:/product-categories");
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
