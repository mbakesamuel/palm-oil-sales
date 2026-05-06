"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { syncLatestVatScheduleToCompanyRate } from "@/lib/tax/bootstrap";
import { Prisma } from "@prisma/client";
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
  await assertPermissionKey("route:/setup");
  const prisma = getPrismaClient();
  const companyName = String(formData.get("companyName") ?? "").trim();
  const logoUrlRaw = String(formData.get("logoUrl") ?? "").trim();
  const logoUrl =
    logoUrlRaw &&
    (logoUrlRaw.startsWith("/") ||
      logoUrlRaw.startsWith("https://") ||
      logoUrlRaw.startsWith("http://"))
      ? logoUrlRaw
      : null;
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
      logoUrl,
      department,
      phone,
      address,
      invoicePrefix,
      vatRate,
      fiscalYearStartMonth,
    },
    update: {
      companyName,
      logoUrl,
      department,
      phone,
      address,
      invoicePrefix,
      vatRate,
      fiscalYearStartMonth,
    },
  });

  await syncLatestVatScheduleToCompanyRate(new Prisma.Decimal(vatRate));

  // Ensure there is at least one admin and one clerk user for per-user cash tracking.
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const firstSp = await prisma.salesPoint.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    });
    await prisma.user.createMany({
      data: [
        {
          username: "admin",
          name: "Administrator",
          passwordPlain: "admin",
          role: "ADMIN",
          salesPointId: null,
        },
        {
          username: "clerk",
          name: "Clerk",
          passwordPlain: "clerk",
          role: "CLERK",
          salesPointId: firstSp?.id ?? null,
        },
      ],
    });
  }

  revalidatePath("/setup");
  revalidatePath("/dashboard");
  revalidatePath("/delivery-orders");
  revalidatePath("/");
}

