"use server";

import { getPrismaClient } from "@/lib/prisma";
import {
  noonUtcFromIsoDate,
  normalizeIsoDateInput,
  utcIsoDateToday,
} from "@/lib/posting-calendar";
import {
  resolveBottledUnitPriceExTax,
  resolveUnitPriceExTax,
} from "@/lib/pricing/resolve";

export async function previewProductUnitPrice(
  customerId: string,
  productId: number,
  dateIsoRaw: string,
): Promise<{ ok: true; unitPriceExTax: string } | { ok: false; error: string }> {
  const prisma = getPrismaClient();
  const dateIso = normalizeIsoDateInput(dateIsoRaw.trim()) ?? utcIsoDateToday();
  const soldAt = noonUtcFromIsoDate(dateIso);

  if (!customerId.trim()) {
    return { ok: false, error: "Customer is required to resolve price." };
  }
  if (!Number.isFinite(productId)) {
    return { ok: false, error: "Invalid product." };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { customerType: true },
  });
  if (!customer) {
    return { ok: false, error: "Customer not found." };
  }

  const r = await resolveUnitPriceExTax(
    prisma,
    productId,
    customer.customerType,
    soldAt,
  );
  if (!r.ok) return r;
  return { ok: true, unitPriceExTax: r.unitPriceExTax.toString() };
}

/** @deprecated Use previewBottledUnitPrice — variants removed. */
export async function previewProductVariantUnitPrice(
  productIdRaw: string,
  dateIsoRaw: string,
): Promise<{ ok: true; unitPriceExTax: string } | { ok: false; error: string }> {
  return previewBottledUnitPrice(productIdRaw, dateIsoRaw);
}

export async function previewBottledUnitPrice(
  productIdRaw: string,
  dateIsoRaw: string,
): Promise<{ ok: true; unitPriceExTax: string } | { ok: false; error: string }> {
  const prisma = getPrismaClient();
  const dateIso = normalizeIsoDateInput(dateIsoRaw.trim()) ?? utcIsoDateToday();
  const soldAt = noonUtcFromIsoDate(dateIso);
  const productId = Number.parseInt(String(productIdRaw ?? "").trim(), 10);
  if (!Number.isFinite(productId)) {
    return { ok: false, error: "Select a bottled product." };
  }

  const r = await resolveBottledUnitPriceExTax(prisma, productId, soldAt);
  if (!r.ok) return r;
  return { ok: true, unitPriceExTax: r.unitPriceExTax.toString() };
}
