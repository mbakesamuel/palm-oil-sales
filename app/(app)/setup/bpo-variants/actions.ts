"use server";

import { assertActorIsAdmin } from "@/lib/access-control";
import { dQty, money2 } from "@/lib/bpo";
import { getPrismaClient } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

function parseIsoDate(raw: string): Date | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

function revalidateBpoSetup() {
  revalidatePath("/setup/bpo-variants");
  revalidatePath("/setup/product-pricing");
  revalidatePath("/pos");
  revalidatePath("/stock/bpo-consignments");
}

export async function saveBpoVariant(formData: FormData) {
  await assertActorIsAdmin();
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);
  const name = String(formData.get("name") ?? "").trim();
  const unitLabel = String(formData.get("unitLabel") ?? "").trim() || "Bottle";
  const unitQuantityRaw = String(formData.get("unitQuantity") ?? "").trim();
  const isActive = String(formData.get("isActive") ?? "") === "on";

  if (!Number.isFinite(productId)) throw new Error("Select a Bottled Palm Oil product.");
  if (!name) throw new Error("Variant name is required.");
  const product = await prisma.product.findUnique({
    where: { productId },
    select: { isBottledPalmOil: true },
  });
  if (!product?.isBottledPalmOil) {
    throw new Error("Variants can only be added to a product flagged as Bottled Palm Oil.");
  }

  const unitQuantity = unitQuantityRaw ? dQty(unitQuantityRaw) : null;
  if (unitQuantity && unitQuantity.lte(0)) throw new Error("Unit quantity must be greater than zero.");

  if (id) {
    await prisma.productVariant.update({
      where: { id },
      data: { productId, name, unitLabel, unitQuantity, isActive },
    });
  } else {
    await prisma.productVariant.create({
      data: { productId, name, unitLabel, unitQuantity, isActive },
    });
  }
  revalidateBpoSetup();
}

export async function deleteBpoVariant(formData: FormData) {
  await assertActorIsAdmin();
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing variant.");
  const counts = await prisma.productVariant.findUnique({
    where: { id },
    select: {
      _count: {
        select: {
          priceSchedules: true,
          bpoBatches: true,
          bpoMovementLines: true,
          saleLines: true,
          bpoAllocations: true,
        },
      },
    },
  });
  if (!counts) throw new Error("Variant not found.");
  const used =
    counts._count.priceSchedules +
    counts._count.bpoBatches +
    counts._count.bpoMovementLines +
    counts._count.saleLines +
    counts._count.bpoAllocations;
  if (used > 0) {
    throw new Error("Cannot delete a variant that has pricing, stock, movements, or sales.");
  }
  await prisma.productVariant.delete({ where: { id } });
  revalidateBpoSetup();
}

export async function saveBpoVariantPrice(formData: FormData) {
  await assertActorIsAdmin();
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  const productVariantId = String(formData.get("productVariantId") ?? "").trim();
  const effectiveFrom = parseIsoDate(String(formData.get("effectiveFrom") ?? ""));
  const unitPriceRaw = String(formData.get("unitPriceExTax") ?? "").trim();
  if (!productVariantId) throw new Error("Select a variant.");
  if (!effectiveFrom) throw new Error("Effective date must be YYYY-MM-DD.");
  if (!unitPriceRaw) throw new Error("Unit price is required.");
  const unitPriceExTax = money2(new Prisma.Decimal(unitPriceRaw.replace(",", ".")));
  if (unitPriceExTax.lt(0)) throw new Error("Unit price must be non-negative.");

  const variant = await prisma.productVariant.findUnique({
    where: { id: productVariantId },
    select: { product: { select: { isBottledPalmOil: true } } },
  });
  if (!variant?.product.isBottledPalmOil) throw new Error("Variant is not a Bottled Palm Oil variant.");

  if (id) {
    await prisma.productVariantPriceSchedule.update({
      where: { id },
      data: { productVariantId, effectiveFrom, unitPriceExTax },
    });
  } else {
    await prisma.productVariantPriceSchedule.create({
      data: { productVariantId, effectiveFrom, unitPriceExTax },
    });
  }
  revalidateBpoSetup();
}

export async function deleteBpoVariantPrice(formData: FormData) {
  await assertActorIsAdmin();
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing price row.");
  await prisma.productVariantPriceSchedule.delete({ where: { id } });
  revalidateBpoSetup();
}
