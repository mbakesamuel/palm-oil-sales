"use server";

import { assertPermissionKey } from "@/lib/access-control";
import {
  upsertSalesTaxScheduleForVariant,
  upsertVatScheduleForEffectiveDate,
} from "@/lib/tax/bootstrap";
import { revalidatePath } from "next/cache";
import { TaxRateVariant } from "@prisma/client";

function parseIsoDate(raw: string): Date | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return new Date(`${s}T00:00:00.000Z`);
}

function parseVatEffectiveIsoDate(raw: string): string | null {
  const s = String(raw ?? "").trim();
  const fallback = () => {
    const t = new Date();
    const y = t.getUTCFullYear();
    const m = String(t.getUTCMonth() + 1).padStart(2, "0");
    const d = String(t.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  if (!s) return fallback();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

/** Accept percent (19.25) or decimal (0.1925); returns decimal string for Prisma. */
function parseRateInput(raw: string): string | null {
  const trimmed = raw.trim().replace("%", "");
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  const decimal = num > 1 ? num / 100 : num;
  if (decimal >= 1) return null;
  return decimal.toString();
}

export async function saveVatRate(formData: FormData) {
  await assertPermissionKey("route:/setup/tax-rates");
  const rateRaw = String(formData.get("ratePercent") ?? "").trim();
  const effectiveRaw = String(formData.get("effectiveFrom") ?? "").trim();

  const rate = parseRateInput(rateRaw);
  if (!rate) {
    throw new Error("VAT rate must be a positive percentage (e.g. 19.25) or decimal (e.g. 0.1925).");
  }
  const effectiveIso = parseVatEffectiveIsoDate(effectiveRaw);
  if (!effectiveIso) {
    throw new Error("Effective from must be YYYY-MM-DD.");
  }

  await upsertVatScheduleForEffectiveDate(rate, new Date(`${effectiveIso}T00:00:00.000Z`));

  revalidatePath("/setup/tax-rates");
  revalidatePath("/setup");
  revalidatePath("/tax-types");
  revalidatePath("/pos");
}

export async function saveSalesTaxRate(formData: FormData) {
  await assertPermissionKey("route:/setup/tax-rates");
  const variantRaw = String(formData.get("variant") ?? "").trim();
  const rateRaw = String(formData.get("ratePercent") ?? "").trim();
  const effectiveFromRaw = String(formData.get("effectiveFrom") ?? "").trim();

  if (!(variantRaw in TaxRateVariant)) {
    throw new Error("Invalid sales tax variant.");
  }
  const variant = variantRaw as TaxRateVariant;
  if (
    variant !== TaxRateVariant.REAL &&
    variant !== TaxRateVariant.SIMPLIFIED &&
    variant !== TaxRateVariant.NO_TAXPAYER_ID
  ) {
    throw new Error("Variant must be Real, Simplified, or No taxpayer card.");
  }

  const rate = parseRateInput(rateRaw);
  if (!rate) {
    throw new Error("Rate must be a positive percentage (e.g. 5) or decimal (e.g. 0.05).");
  }

  const effectiveFrom = parseIsoDate(effectiveFromRaw);
  if (!effectiveFrom) {
    throw new Error("Effective from must be YYYY-MM-DD.");
  }

  await upsertSalesTaxScheduleForVariant(variant, rate, effectiveFrom);

  revalidatePath("/setup/tax-rates");
  revalidatePath("/tax-types");
  revalidatePath("/tax-regimes");
  revalidatePath("/customers");
  revalidatePath("/pos");
}
