"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { VAT_TAX_CODE } from "@/lib/tax/constants";
import { revalidatePath } from "next/cache";
import { TaxRegimeKind } from "@prisma/client";

function taxTypeIdsFromForm(formData: FormData): string[] {
  const raw = formData.getAll("taxTypeId");
  const out: string[] = [];
  for (const x of raw) {
    const s = String(x ?? "").trim();
    if (s) out.push(s);
  }
  return [...new Set(out)];
}

async function mergedTaxTypeIdsForRegime(
  prisma: ReturnType<typeof getPrismaClient>,
  taxTypeIds: string[],
  vatAppliesCheckbox: boolean,
): Promise<{ merged: string[]; vatApplies: boolean }> {
  const vatType = await prisma.taxType.findUnique({
    where: { code: VAT_TAX_CODE },
    select: { id: true },
  });
  let merged = [...taxTypeIds];
  if (vatType) {
    if (vatAppliesCheckbox && !merged.includes(vatType.id)) {
      merged.push(vatType.id);
    }
    if (!vatAppliesCheckbox) {
      merged = merged.filter((id) => id !== vatType.id);
    }
    return { merged, vatApplies: merged.includes(vatType.id) };
  }
  return { merged, vatApplies: vatAppliesCheckbox };
}

function commercialServiceIdFromForm(formData: FormData): string | null {
  const raw = String(formData.get("commercialServiceId") ?? "").trim();
  return raw.length ? raw : null;
}

export async function createTaxRegime(formData: FormData) {
  await assertPermissionKey("route:/tax-regimes");
  const prisma = getPrismaClient();
  const name = String(formData.get("name") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "SIMPLIFIED").trim();
  const vatAppliesCheckbox = String(formData.get("vatApplies") ?? "") === "on";

  if (!name) throw new Error("Name is required.");
  const kind =
    kindRaw in TaxRegimeKind ? (kindRaw as TaxRegimeKind) : TaxRegimeKind.SIMPLIFIED;

  const { merged, vatApplies } = await mergedTaxTypeIdsForRegime(
    prisma,
    taxTypeIdsFromForm(formData),
    vatAppliesCheckbox,
  );

  const regime = await prisma.taxRegime.create({
    data: {
      name,
      kind,
      vatApplies,
      commercialServiceId: commercialServiceIdFromForm(formData),
    },
  });

  if (merged.length > 0) {
    await prisma.taxRegimeTax.createMany({
      data: merged.map((taxTypeId) => ({ taxRegimeId: regime.id, taxTypeId })),
    });
  }

  revalidatePath("/tax-regimes");
  revalidatePath("/customers");
  revalidatePath("/pos");
}

export async function updateTaxRegime(formData: FormData) {
  await assertPermissionKey("route:/tax-regimes");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "SIMPLIFIED").trim();
  const vatAppliesCheckbox = String(formData.get("vatApplies") ?? "") === "on";

  if (!id) throw new Error("Missing id.");
  if (!name) throw new Error("Name is required.");
  const kind =
    kindRaw in TaxRegimeKind ? (kindRaw as TaxRegimeKind) : TaxRegimeKind.SIMPLIFIED;

  const { merged, vatApplies } = await mergedTaxTypeIdsForRegime(
    prisma,
    taxTypeIdsFromForm(formData),
    vatAppliesCheckbox,
  );

  await prisma.taxRegime.update({
    where: { id },
    data: {
      name,
      kind,
      vatApplies,
      commercialServiceId: commercialServiceIdFromForm(formData),
    },
  });

  await prisma.taxRegimeTax.deleteMany({ where: { taxRegimeId: id } });
  if (merged.length > 0) {
    await prisma.taxRegimeTax.createMany({
      data: merged.map((taxTypeId) => ({ taxRegimeId: id, taxTypeId })),
    });
  }

  revalidatePath("/tax-regimes");
  revalidatePath("/customers");
  revalidatePath("/pos");
}

export async function saveTaxRegime(formData: FormData) {
  await assertPermissionKey("route:/tax-regimes");
  const id = String(formData.get("id") ?? "").trim();
  if (id) return updateTaxRegime(formData);
  return createTaxRegime(formData);
}

export async function deleteTaxRegime(formData: FormData) {
  await assertPermissionKey("route:/tax-regimes");
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing id.");

  await prisma.taxRegime.delete({ where: { id } });

  revalidatePath("/tax-regimes");
  revalidatePath("/customers");
  revalidatePath("/pos");
}
