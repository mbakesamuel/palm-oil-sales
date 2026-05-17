"use server";

import { assertPermissionKey } from "@/lib/access-control";
import { getPrismaClient } from "@/lib/prisma";
import { ensureTaxCatalogSynced, upsertVatScheduleForEffectiveDate } from "@/lib/tax/bootstrap";
import { Prisma, type UiThemePreset } from "@prisma/client";
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

function parseUiThemePreset(raw: string): UiThemePreset {
  const v = String(raw ?? "").trim();
  if (v === "agro") return "agro";
  return "default";
}

/** Calendar day (YYYY-MM-DD) for VAT schedule row (UTC midnight). Blank = UTC today. */
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
  const vatRateRaw = String(formData.get("vatRate") ?? "").trim();
  const vatEffectiveRaw = String(formData.get("vatEffectiveFrom") ?? "").trim();
  const fiscalYearStartMonth = parseFiscalYearStartMonth(
    String(formData.get("fiscalYearStartMonth") ?? "1"),
  );
  const uiThemePreset = parseUiThemePreset(String(formData.get("uiThemePreset") ?? "default"));

  if (!companyName) {
    throw new Error("Company name is required.");
  }

  const vatRate = parseVatRate(vatRateRaw);
  if (!vatRate) {
    throw new Error("VAT rate must be a decimal like 0.1925.");
  }
  const vatEffectiveIso = parseVatEffectiveIsoDate(vatEffectiveRaw);
  if (!vatEffectiveIso) {
    throw new Error("VAT effective from must be YYYY-MM-DD.");
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
      vatRate,
      fiscalYearStartMonth,
      uiThemePreset,
    },
    update: {
      companyName,
      logoUrl,
      department,
      vatRate,
      fiscalYearStartMonth,
      uiThemePreset,
    },
  });

  const merged = await prisma.companySettings.findUniqueOrThrow({
    where: { id: "default" },
  });
  await ensureTaxCatalogSynced(merged);
  await upsertVatScheduleForEffectiveDate(
    new Prisma.Decimal(vatRate),
    new Date(`${vatEffectiveIso}T00:00:00.000Z`),
  );

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
  revalidatePath("/login");
}

