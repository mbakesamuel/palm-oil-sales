"use server";

import { getServerSession } from "@/lib/auth-server";
import {
  canSetSalesPointWorkingMonth,
  getSalesPointWorkingMonth,
  resolveWorkingMonthForSession,
  setSalesPointWorkingMonth,
} from "@/lib/sales-point-working-month";

export type WorkingMonthSessionPayload = {
  financialYear: number;
  calendarYear: number;
  calendarMonth: number;
  source: "sales_point" | "personal";
  canChange: boolean;
  salesPointId: number | null;
  salesPointName: string | null;
};

export async function getWorkingMonthForSessionAction(): Promise<
  WorkingMonthSessionPayload | { error: string }
> {
  const session = await getServerSession();
  if (!session) return { error: "Login required." };

  const resolved = await resolveWorkingMonthForSession(session);
  if (!resolved) {
    return { error: "No open financial year or no selectable working months." };
  }

  return {
    financialYear: resolved.financialYear,
    calendarYear: resolved.calendarYear,
    calendarMonth: resolved.calendarMonth,
    source: resolved.source,
    canChange: resolved.canChange,
    salesPointId: resolved.salesPointId,
    salesPointName: resolved.salesPointName,
  };
}

export async function setSalesPointWorkingMonthAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getServerSession();
  if (!session) return { ok: false, error: "Login required." };

  const salesPointIdRaw = String(formData.get("salesPointId") ?? "").trim();
  const calendarYearRaw = String(formData.get("calendarYear") ?? "").trim();
  const calendarMonthRaw = String(formData.get("calendarMonth") ?? "").trim();

  const salesPointId = Number.parseInt(salesPointIdRaw, 10);
  const calendarYear = Number.parseInt(calendarYearRaw, 10);
  const calendarMonth = Number.parseInt(calendarMonthRaw, 10);

  if (!Number.isFinite(salesPointId)) {
    return { ok: false, error: "Sales point is required." };
  }
  if (!Number.isFinite(calendarYear) || !Number.isFinite(calendarMonth)) {
    return { ok: false, error: "Calendar year and month are required." };
  }

  return setSalesPointWorkingMonth(
    session,
    salesPointId,
    calendarYear,
    calendarMonth,
  );
}

export async function getSalesPointWorkingMonthAction(
  salesPointId: number,
): Promise<
  | {
      salesPointId: number;
      salesPointName: string;
      financialYear: number;
      calendarYear: number;
      calendarMonth: number;
    }
  | { error: string }
> {
  const session = await getServerSession();
  if (!session) return { error: "Login required." };
  if (!(await canSetSalesPointWorkingMonth(session, salesPointId))) {
    return { error: "You cannot view this sales point working month." };
  }
  try {
    const site = await getSalesPointWorkingMonth(salesPointId);
    return site;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not load working month.",
    };
  }
}
