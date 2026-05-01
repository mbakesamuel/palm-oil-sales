"use server";

import { getPrismaClient } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-server";
import { FinancialYearStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

async function assertCanManageCalendarFromSession() {
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
  const role = session.role as UserRole;
  if (role !== UserRole.ADMIN && role !== UserRole.MANAGER) {
    throw new Error("Only admin or manager can manage the financial year calendar (open / close).");
  }
}

function parseFormIsoDate(raw: string, label: string): Date {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`${label} must be YYYY-MM-DD.`);
  }
  return new Date(`${s}T12:00:00.000Z`);
}

export async function openFinancialYearPeriod(formData: FormData) {
  await assertCanManageCalendarFromSession();

  const yRaw = String(formData.get("financialYear") ?? "").trim();
  const y = Number.parseInt(yRaw, 10);
  if (!Number.isFinite(y) || y < 1900 || y > 2100) {
    throw new Error("Enter a valid financial year label (number).");
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
    const startRaw = String(formData.get("startDate") ?? "").trim();
    const endRaw = String(formData.get("endDate") ?? "").trim();
    if (!startRaw || !endRaw) {
      throw new Error(
        "Start date and end date are required when creating a new financial year record.",
      );
    }
    const startDate = parseFormIsoDate(startRaw, "Start date");
    const endDate = parseFormIsoDate(endRaw, "End date");
    if (startDate.getTime() > endDate.getTime()) {
      throw new Error("Financial year start date must be on or before the end date.");
    }
    await prisma.financialYearPeriod.create({
      data: {
        financialYear: y,
        startDate,
        endDate,
        status: FinancialYearStatus.OPEN,
      },
    });
  }

  revalidatePath("/financial-years");
  revalidatePath("/dashboard");
  revalidatePath("/pos");
  revalidatePath("/delivery-orders");
}

export async function closeFinancialYearPeriod(formData: FormData) {
  await assertCanManageCalendarFromSession();

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
