"use server";

import { assertActorIsAdmin } from "@/lib/access-control";
import { MAIN_PRODUCT_CATEGORY_ID } from "@/lib/pricing/constants";
import { getPrismaClient } from "@/lib/prisma";
import { CustomerType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

function parseIsoDate(raw: string): Date | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

function money2(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function parseCustomerTypeMain(raw: string): CustomerType {
  const s = String(raw ?? "").trim() as CustomerType;
  if (
    s !== CustomerType.INDUSTRY &&
    s !== CustomerType.WHOLE_SALE &&
    s !== CustomerType.RETAIL &&
    s !== CustomerType.WORKER
  ) {
    throw new Error("Choose a customer type for Main-category products.");
  }
  return s;
}

export async function saveProductUnitPriceSchedule(formData: FormData) {
  await assertActorIsAdmin();
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  const productId = Number.parseInt(String(formData.get("productId") ?? ""), 10);
  const effectiveFromRaw = String(formData.get("effectiveFrom") ?? "").trim();
  const unitPriceRaw = String(formData.get("unitPriceExTax") ?? "").trim();

  if (!Number.isFinite(productId)) throw new Error("Product is required.");
  const effectiveFrom = parseIsoDate(effectiveFromRaw);
  if (!effectiveFrom) throw new Error("Effective date must be YYYY-MM-DD.");
  if (!unitPriceRaw.trim()) throw new Error("Unit price (ex tax) is required.");
  const unitDec = new Prisma.Decimal(unitPriceRaw.replace(",", "."));
  if (!unitDec.isFinite() || unitDec.lt(0)) {
    throw new Error("Unit price must be a non-negative number.");
  }
  const unitPriceExTax = money2(unitDec);

  const product = await prisma.product.findUnique({
    where: { productId },
    select: { productCatId: true, productName: true },
  });
  if (!product) throw new Error("Product not found.");

  const isMain = product.productCatId === MAIN_PRODUCT_CATEGORY_ID;
  let customerType: CustomerType | null = null;
  if (isMain) {
    customerType = parseCustomerTypeMain(String(formData.get("customerType") ?? ""));
  } else {
    const ct = String(formData.get("customerType") ?? "").trim();
    if (ct) {
      throw new Error("Only Main-category products use customer type on price rows.");
    }
  }

  try {
    if (id) {
      await prisma.productUnitPriceSchedule.update({
        where: { id },
        data: {
          productId,
          customerType,
          unitPriceExTax,
          effectiveFrom,
        },
      });
    } else {
      await prisma.productUnitPriceSchedule.create({
        data: {
          productId,
          customerType,
          unitPriceExTax,
          effectiveFrom,
        },
      });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error(
        "A price row already exists for this product, customer segment, and effective date.",
      );
    }
    throw e;
  }

  revalidatePath("/setup/product-pricing");
}

export async function deleteProductUnitPriceSchedule(formData: FormData) {
  await assertActorIsAdmin();
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing id.");

  await prisma.productUnitPriceSchedule.delete({ where: { id } });
  revalidatePath("/setup/product-pricing");
}
