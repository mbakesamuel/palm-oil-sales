"use server";

import { Prisma } from "@prisma/client";
import { assertPermissionKey } from "@/lib/access-control";
import { getFinancialYearPeriodByYear } from "@/lib/financial-year";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getPrismaClient } from "@/lib/prisma";
import { prismaDateToIso } from "@/lib/posting-calendar";
import {
  getOrInitSalesBudgetMonthPhaseProfile,
  profileRowToPercentDecimals,
  sumProfilePercents,
} from "@/lib/sales-budget-profile";
import { buildSalesBudgetPhase, type SalesBudgetPhaseResult } from "@/lib/sales-budget-phase";
import { revalidatePath } from "next/cache";

const PATH = "/setup/sales-budget";
const PCT_TOLERANCE = new Prisma.Decimal("0.02");

function parsePct(raw: string): Prisma.Decimal {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (!s) return new Prisma.Decimal(0);
  const d = new Prisma.Decimal(s);
  if (!d.isFinite()) throw new Error("Invalid percentage.");
  return d;
}

export async function saveSalesBudgetPhaseProfile(formData: FormData) {
  await assertPermissionKey("route:/setup/sales-budget");
  const pcts: Prisma.Decimal[] = [];
  for (let i = 1; i <= 12; i++) {
    const key = `pctM${String(i).padStart(2, "0")}` as const;
    pcts.push(parsePct(String(formData.get(key) ?? "")));
  }
  const sum = sumProfilePercents(pcts);
  const hundred = new Prisma.Decimal(100);
  if (sum.sub(hundred).abs().gt(PCT_TOLERANCE)) {
    throw new Error(`Percentages must sum to 100 (currently ${sum.toFixed(4)}%).`);
  }

  const prisma = getPrismaClient();
  await prisma.salesBudgetMonthPhaseProfile.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      pctM01: pcts[0]!,
      pctM02: pcts[1]!,
      pctM03: pcts[2]!,
      pctM04: pcts[3]!,
      pctM05: pcts[4]!,
      pctM06: pcts[5]!,
      pctM07: pcts[6]!,
      pctM08: pcts[7]!,
      pctM09: pcts[8]!,
      pctM10: pcts[9]!,
      pctM11: pcts[10]!,
      pctM12: pcts[11]!,
    },
    update: {
      pctM01: pcts[0]!,
      pctM02: pcts[1]!,
      pctM03: pcts[2]!,
      pctM04: pcts[3]!,
      pctM05: pcts[4]!,
      pctM06: pcts[5]!,
      pctM07: pcts[6]!,
      pctM08: pcts[7]!,
      pctM09: pcts[8]!,
      pctM10: pcts[9]!,
      pctM11: pcts[10]!,
      pctM12: pcts[11]!,
    },
  });

  revalidatePath(PATH);
}

function parseFinancialYear(formData: FormData): number {
  const raw = String(formData.get("financialYear") ?? "").trim();
  const y = Number.parseInt(raw, 10);
  if (!Number.isFinite(y)) throw new Error("Financial year is required.");
  return y;
}

function parseProductId(formData: FormData): number {
  const raw = String(formData.get("productId") ?? "").trim();
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id)) throw new Error("Product is required.");
  return id;
}

function parseQtyKg(formData: FormData): Prisma.Decimal {
  const raw = String(formData.get("annualQtyKg") ?? "").trim().replace(",", ".");
  if (!raw) throw new Error("Annual quantity (kg) is required.");
  const d = new Prisma.Decimal(raw);
  if (!d.isFinite() || d.lt(0)) throw new Error("Invalid annual quantity.");
  return d.toDecimalPlaces(3);
}

function parsePrice(formData: FormData): Prisma.Decimal {
  const raw = String(formData.get("budgetUnitPricePerKg") ?? "").trim().replace(",", ".");
  if (!raw) throw new Error("Budget unit price per kg is required.");
  const d = new Prisma.Decimal(raw);
  if (!d.isFinite() || d.lt(0)) throw new Error("Invalid unit price.");
  return d.toDecimalPlaces(2);
}

export async function upsertProductSalesBudget(formData: FormData) {
  await assertPermissionKey("route:/setup/sales-budget");
  const financialYear = parseFinancialYear(formData);
  const productId = parseProductId(formData);
  const annualQtyKg = parseQtyKg(formData);
  const budgetUnitPricePerKg = parsePrice(formData);

  const fy = await getFinancialYearPeriodByYear(financialYear);
  if (!fy) {
    throw new Error(`Financial year ${financialYear} is not defined. Create it under Financial years first.`);
  }

  const prisma = getPrismaClient();
  await prisma.productSalesBudget.upsert({
    where: {
      financialYear_productId: { financialYear, productId },
    },
    create: {
      financialYear,
      productId,
      annualQtyKg,
      budgetUnitPricePerKg,
    },
    update: {
      annualQtyKg,
      budgetUnitPricePerKg,
    },
  });

  revalidatePath(PATH);
}

export async function deleteProductSalesBudget(formData: FormData) {
  await assertPermissionKey("route:/setup/sales-budget");
  const financialYear = parseFinancialYear(formData);
  const productId = parseProductId(formData);

  const prisma = getPrismaClient();
  await prisma.productSalesBudget.deleteMany({
    where: { financialYear, productId },
  });

  revalidatePath(PATH);
}

export async function previewSalesBudgetPhaseAction(formData: FormData): Promise<SalesBudgetPhaseResult> {
  await assertPermissionKey("route:/setup/sales-budget");
  const financialYear = parseFinancialYear(formData);
  const annualQtyKg = parseQtyKg(formData);
  const budgetUnitPricePerKg = parsePrice(formData);

  const [fy, settings, profile] = await Promise.all([
    getFinancialYearPeriodByYear(financialYear),
    getOrInitCompanySettings(),
    getOrInitSalesBudgetMonthPhaseProfile(),
  ]);

  if (!fy) {
    throw new Error(`Financial year ${financialYear} is not defined.`);
  }

  const fyStartIso = prismaDateToIso(fy.startDate);
  const fyEndIso = prismaDateToIso(fy.endDate);
  const pcts = profileRowToPercentDecimals(profile);

  return buildSalesBudgetPhase({
    financialYear,
    fiscalYearStartMonth: settings.fiscalYearStartMonth,
    fyStartIso,
    fyEndIso,
    annualQtyKg,
    budgetUnitPricePerKg,
    fiscalMonthPercents: pcts,
  });
}
