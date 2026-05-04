"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const paths = ["/products", "/product-categories", "/pos", "/delivery-orders"];

function revalidateAll() {
  for (const p of paths) revalidatePath(p);
}

export async function createProduct(formData: FormData) {
  await assertPermissionKey("route:/products");
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

  revalidateAll();
}

export async function updateProduct(formData: FormData) {
  await assertPermissionKey("route:/products");
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("productId") ?? "").trim();
  const productName = String(formData.get("productName") ?? "").trim();
  const productCodeRaw = String(formData.get("productCode") ?? "").trim();
  const productCatIdRaw = String(formData.get("productCatId") ?? "").trim();

  const productId = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(productId)) throw new Error("Invalid product.");
  if (!productName) throw new Error("Product name is required.");
  if (!productCatIdRaw) throw new Error("Category is required.");

  const productCatId = Number.parseInt(productCatIdRaw, 10);
  if (!Number.isFinite(productCatId)) throw new Error("Invalid category.");

  await prisma.product.update({
    where: { productId },
    data: {
      productName,
      productCode: productCodeRaw || null,
      productCatId,
    },
  });

  revalidateAll();
}

export async function saveProduct(formData: FormData) {
  await assertPermissionKey("route:/products");
  const idRaw = String(formData.get("productId") ?? "").trim();
  if (idRaw) return updateProduct(formData);
  return createProduct(formData);
}

export async function deleteProduct(formData: FormData) {
  await assertPermissionKey("route:/products");
  const prisma = getPrismaClient();
  const idRaw = String(formData.get("productId") ?? "").trim();
  const productId = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(productId)) throw new Error("Invalid product.");

  const counts = await prisma.product.findUnique({
    where: { productId },
    select: {
      _count: {
        select: {
          batches: true,
          saleLines: true,
          deliveryOrderDetails: true,
        },
      },
    },
  });
  if (!counts) throw new Error("Product not found.");

  const n =
    counts._count.batches + counts._count.saleLines + counts._count.deliveryOrderDetails;
  if (n > 0) {
    throw new Error(
      "Cannot delete this product while it is used on batches, sales, or delivery orders.",
    );
  }

  await prisma.product.delete({ where: { productId } });
  revalidateAll();
}
