"use server";

import { getPrismaClient } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createTaxRegime(formData: FormData) {
  const prisma = getPrismaClient();
  const name = String(formData.get("name") ?? "").trim();
  const vatApplies = String(formData.get("vatApplies") ?? "") === "on";

  if (!name) throw new Error("Name is required.");

  await prisma.taxRegime.create({
    data: { name, vatApplies },
  });

  revalidatePath("/tax-regimes");
  revalidatePath("/customers");
  revalidatePath("/pos");
}

export async function updateTaxRegime(formData: FormData) {
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const vatApplies = String(formData.get("vatApplies") ?? "") === "on";

  if (!id) throw new Error("Missing id.");
  if (!name) throw new Error("Name is required.");

  await prisma.taxRegime.update({
    where: { id },
    data: { name, vatApplies },
  });

  revalidatePath("/tax-regimes");
  revalidatePath("/customers");
  revalidatePath("/pos");
}

export async function saveTaxRegime(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (id) return updateTaxRegime(formData);
  return createTaxRegime(formData);
}

export async function deleteTaxRegime(formData: FormData) {
  const prisma = getPrismaClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing id.");

  await prisma.taxRegime.delete({ where: { id } });

  revalidatePath("/tax-regimes");
  revalidatePath("/customers");
  revalidatePath("/pos");
}

