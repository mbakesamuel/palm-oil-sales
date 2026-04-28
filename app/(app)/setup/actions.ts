"use server";

import { getPrismaClient } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function parseVatRate(input: string) {
  const trimmed = input.trim();
  const num = Number.parseFloat(trimmed);
  if (!Number.isFinite(num) || num <= 0 || num >= 1) return null;
  return num.toString();
}

function parseFiscalYearStartMonth(raw: string): number | null {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return n;
}

export async function saveCompanySettings(formData: FormData) {
  const prisma = getPrismaClient();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const department = String(formData.get("department") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const invoicePrefix = String(formData.get("invoicePrefix") ?? "").trim() || "PO";
  const vatRateRaw = String(formData.get("vatRate") ?? "").trim();
  const fiscalYearStartMonth = parseFiscalYearStartMonth(
    String(formData.get("fiscalYearStartMonth") ?? "1"),
  );

  if (!companyName) {
    throw new Error("Company name is required.");
  }

  const vatRate = parseVatRate(vatRateRaw);
  if (!vatRate) {
    throw new Error("VAT rate must be a decimal like 0.1925.");
  }
  if (fiscalYearStartMonth == null) {
    throw new Error("Financial year start month must be between 1 and 12.");
  }

  await prisma.companySettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      companyName,
      department,
      phone,
      address,
      invoicePrefix,
      vatRate,
      fiscalYearStartMonth,
    },
    update: {
      companyName,
      department,
      phone,
      address,
      invoicePrefix,
      vatRate,
      fiscalYearStartMonth,
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
  revalidatePath("/dashboard");
  revalidatePath("/delivery-orders");
  revalidatePath("/");
}

