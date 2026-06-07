"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { isOperationalTaxCode } from "@/lib/tax/constants";
import { revalidatePath } from "next/cache";
import { TaxRateVariant } from "@prisma/client";

function parseTaxRate(raw: string) {
  const trimmed = raw.trim();
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num) || num < 0 || num >= 1) return null;
  return num.toString();
}

function parseIsoDate(raw: string): Date | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

export async function saveTaxType(formData: FormData) {
  await assertPermissionKey("route:/tax-types");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrderRaw = String(formData.get("sortOrder") ?? "0").trim();
  const sortOrder = Number.parseInt(sortOrderRaw, 10);

  if (!code) throw new Error("Tax code is required.");
  if (!name) throw new Error("Display name is required.");
  if (!Number.isFinite(sortOrder)) throw new Error("Sort order must be a number.");

  if (id) {
    await prisma.taxType.update({
      where: { id },
      data: { code, name, sortOrder },
    });
  } else {
    await prisma.taxType.create({ data: { code, name, sortOrder } });
  }

  revalidatePath("/tax-types");
  revalidatePath("/tax-regimes");
  revalidatePath("/pos");
}

export async function deleteTaxType(formData: FormData) {
  await assertPermissionKey("route:/tax-types");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing id.");

  const row = await prisma.taxType.findUnique({
    where: { id },
    select: { code: true },
  });
  if (row && isOperationalTaxCode(row.code)) {
    throw new Error(`${row.code} is a built-in tax type and cannot be deleted.`);
  }

  await prisma.taxType.delete({ where: { id } });

  revalidatePath("/tax-types");
  revalidatePath("/tax-regimes");
  revalidatePath("/pos");
}

async function assertCustomTaxTypeForRateEdit(
  prisma: ReturnType<typeof getPrismaClient>,
  taxTypeId: string,
) {
  const row = await prisma.taxType.findUnique({
    where: { id: taxTypeId },
    select: { code: true },
  });
  if (!row) throw new Error("Tax type not found.");
  if (isOperationalTaxCode(row.code)) {
    throw new Error(
      `Rates for ${row.code} are managed on Setup → Tax rates. Use that page instead.`,
    );
  }
}

export async function saveTaxRateSchedule(formData: FormData) {
  await assertPermissionKey("route:/tax-types");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  const taxTypeId = String(formData.get("taxTypeId") ?? "").trim();
  const variantRaw = String(formData.get("variant") ?? "DEFAULT").trim();
  const effectiveFromRaw = String(formData.get("effectiveFrom") ?? "").trim();
  const rateRaw = String(formData.get("rate") ?? "").trim();

  if (!taxTypeId) throw new Error("Tax type is required.");
  await assertCustomTaxTypeForRateEdit(prisma, taxTypeId);
  const variant =
    variantRaw in TaxRateVariant
      ? (variantRaw as TaxRateVariant)
      : TaxRateVariant.DEFAULT;
  const effectiveFrom = parseIsoDate(effectiveFromRaw);
  if (!effectiveFrom) throw new Error("Effective from must be a date (YYYY-MM-DD).");
  const rate = parseTaxRate(rateRaw);
  if (!rate) throw new Error("Rate must be a decimal ≥ 0 and < 1 (e.g. 0.1925).");

  if (id) {
    await prisma.taxRateSchedule.update({
      where: { id },
      data: { variant, rate, effectiveFrom },
    });
  } else {
    await prisma.taxRateSchedule.create({
      data: { taxTypeId, variant, rate, effectiveFrom },
    });
  }

  revalidatePath("/tax-types");
  revalidatePath("/setup/tax-rates");
  revalidatePath("/pos");
}

export async function deleteTaxRateSchedule(formData: FormData) {
  await assertPermissionKey("route:/tax-types");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing id.");

  const row = await prisma.taxRateSchedule.findUnique({
    where: { id },
    select: { taxType: { select: { code: true } } },
  });
  if (!row) throw new Error("Rate row not found.");
  if (isOperationalTaxCode(row.taxType.code)) {
    throw new Error(
      `Rates for ${row.taxType.code} are managed on Setup → Tax rates. Use that page instead.`,
    );
  }

  await prisma.taxRateSchedule.delete({ where: { id } });

  revalidatePath("/tax-types");
  revalidatePath("/setup/tax-rates");
  revalidatePath("/pos");
}
