"use server";

import { getPrismaClient } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function parseVatRate(input: string) {
  const trimmed = input.trim();
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num) || num <= 0 || num >= 1) return null;
  return num.toString();
}

export async function saveCompanySettings(formData: FormData) {
  const prisma = getPrismaClient();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const invoicePrefix = String(formData.get("invoicePrefix") ?? "").trim() || "PO";
  const vatRateRaw = String(formData.get("vatRate") ?? "").trim();

  if (!companyName) {
    throw new Error("Company name is required.");
  }

  const vatRate = parseVatRate(vatRateRaw);
  if (!vatRate) {
    throw new Error("VAT rate must be a decimal like 0.1925.");
  }

  await prisma.companySettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      companyName,
      phone,
      address,
      invoicePrefix,
      vatRate,
    },
    update: {
      companyName,
      phone,
      address,
      invoicePrefix,
      vatRate,
    },
  });

  // Ensure there is at least one admin and one clerk user for per-user cash tracking.
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    await prisma.user.createMany({
      data: [{ name: "Admin", role: "ADMIN" }, { name: "Clerk", role: "CLERK" }],
    });
  }

  revalidatePath("/setup");
  revalidatePath("/");
}

