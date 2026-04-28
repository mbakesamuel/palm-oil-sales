"use server";

import { getPrismaClient } from "@/lib/prisma";
import { FinancialYearStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

function parseRole(formData: FormData): UserRole | null {
  const r = String(formData.get("userRole") ?? "").trim();
  if (r === UserRole.ADMIN || r === UserRole.MANAGER) return r;
  return null;
}

function assertCanManageCalendar(role: UserRole | null) {
  if (role !== UserRole.ADMIN && role !== UserRole.MANAGER) {
    throw new Error("Only admin or manager can manage the financial year calendar (open / close).");
  }
}

export async function openFinancialYearPeriod(formData: FormData) {
  assertCanManageCalendar(parseRole(formData));

  const yRaw = String(formData.get("financialYear") ?? "").trim();
  const y = Number.parseInt(yRaw, 10);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) {
    throw new Error("Enter a valid financial year (calendar year in which the period starts).");
  }

  const prisma = getPrismaClient();

  // Avoid interactive `$transaction` here: Neon pooler + Prisma adapter often hits
  // "Unable to start a transaction in the given time" for interactive transactions.
  const open = await prisma.financialYearPeriod.findFirst({
    where: { status: FinancialYearStatus.OPEN },
  });
  if (open) {
    throw new Error(
      `Close the current financial year (${open.financialYear}) before opening another.`,
    );
  }

  const existing = await prisma.financialYearPeriod.findUnique({ where: { financialYear: y } });
  if (existing) {
    if (existing.status === FinancialYearStatus.OPEN) {
      throw new Error("This financial year is already open.");
    }
    await prisma.financialYearPeriod.update({
      where: { id: existing.id },
      data: {
        status: FinancialYearStatus.OPEN,
        openedAt: new Date(),
        closedAt: null,
      },
    });
  } else {
    await prisma.financialYearPeriod.create({
      data: { financialYear: y, status: FinancialYearStatus.OPEN },
    });
  }

  revalidatePath("/financial-years");
  revalidatePath("/dashboard");
  revalidatePath("/pos");
  revalidatePath("/delivery-orders");
}

export async function closeFinancialYearPeriod(formData: FormData) {
  assertCanManageCalendar(parseRole(formData));

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Missing period.");

  const prisma = getPrismaClient();
  const row = await prisma.financialYearPeriod.findUnique({ where: { id } });
  if (!row) throw new Error("Period not found.");
  if (row.status !== FinancialYearStatus.OPEN) throw new Error("This year is not open.");

  await prisma.financialYearPeriod.update({
    where: { id },
    data: { status: FinancialYearStatus.CLOSED, closedAt: new Date() },
  });

  revalidatePath("/financial-years");
  revalidatePath("/dashboard");
  revalidatePath("/pos");
  revalidatePath("/delivery-orders");
}
