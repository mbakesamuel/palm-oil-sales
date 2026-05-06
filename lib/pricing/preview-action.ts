"use server";

import { getPrismaClient } from "@/lib/prisma";
import {
  noonUtcFromIsoDate,
  normalizeIsoDateInput,
  utcIsoDateToday,
} from "@/lib/posting-calendar";
import { resolveUnitPriceExTax } from "@/lib/pricing/resolve";

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
