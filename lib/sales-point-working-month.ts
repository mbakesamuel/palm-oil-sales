import "server-only";

import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { cookies } from "next/headers";
import type { AuthSession } from "@/lib/auth-session";
import { effectiveSessionRole } from "@/lib/auth-roles";
import { getPermissionsForSession } from "@/lib/access-control";
import {
  assertPostingPeriod,
  getOpenFinancialYearPeriod,
  toOpenFinancialYearForPosting,
} from "@/lib/financial-year";
import { getPrismaClient } from "@/lib/prisma";
import { resolveBotaSalesPointId } from "@/lib/pos/sale-product-mode";
import {
  isPlainSupervisorValidator,
  isSeniorSupervisorValidator,
} from "@/lib/pos/sale-validation-scope";
import {
  defaultSelectableMonthForToday,
  isCalendarMonthFullyInsideFy,
  listSelectableCalendarMonths,
  prismaDateToIso,
  type SelectableMonth,
} from "@/lib/posting-calendar";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { UserRole } from "@/lib/domain";
import { readWorkingCalCookie } from "@/lib/working-period-cookie";

export type WorkingMonthSource = "sales_point" | "personal";

export type ResolvedWorkingMonth = {
  financialYear: number;
  calendarYear: number;
  calendarMonth: number;
  source: WorkingMonthSource;
  canChange: boolean;
  salesPointId: number | null;
  salesPointName: string | null;
};

const salesPointWorkingMonthSelect = {
  id: true,
  name: true,
  workingCalendarYear: true,
  workingCalendarMonth: true,
  workingFinancialYear: true,
} as const;

function pickSelectableMonth(
  selectable: SelectableMonth[],
  year: number,
  month: number,
): SelectableMonth | null {
  return selectable.find((r) => r.year === year && r.month === month) ?? null;
}

/** Fixed-site clerks and line supervisors inherit the sales point working month. */
export function usesSalesPointWorkingMonth(
  session: Pick<
    AuthSession,
    "role" | "globalRole" | "commercialServiceRole" | "salesPoint"
  >,
): boolean {
  return sessionRequiresFixedPostingSite(session) && session.salesPoint != null;
}

export async function canSetSalesPointWorkingMonth(
  session: AuthSession,
  salesPointId: number,
): Promise<boolean> {
  if (session.role === UserRole.ADMIN || session.role === UserRole.DIRECTOR) {
    return true;
  }

  const ctx = {
    role: effectiveSessionRole(session),
    commercialServiceRoleCode: session.commercialServiceRole?.code,
  };

  if (isSeniorSupervisorValidator(ctx)) {
    const botaId = await resolveBotaSalesPointId(getPrismaClient());
    return botaId != null && salesPointId === botaId;
  }

  if (!sessionRequiresFixedPostingSite(session)) return false;
  if (session.salesPoint?.id !== salesPointId) return false;

  const perms = await getPermissionsForSession(session);
  // Custom line role codes (e.g. "sas") map to CLERK but carry validate-documents.
  if (perms["ui:validate-documents"]) return true;

  if (effectiveSessionRole(session) === UserRole.CLERK) return false;
  if (isPlainSupervisorValidator(ctx)) return true;
  return (
    effectiveSessionRole(session) === UserRole.SUPERVISOR ||
    session.role === UserRole.SUPERVISOR
  );
}

async function defaultMonthInOpenFy(): Promise<{
  openFy: NonNullable<Awaited<ReturnType<typeof getOpenFinancialYearPeriod>>>;
  month: SelectableMonth;
  selectable: SelectableMonth[];
}> {
  const openFy = await getOpenFinancialYearPeriod();
  if (!openFy) {
    throw new Error(
      "No financial year is open. An admin or manager must open a period under Financial years.",
    );
  }
  const fyStart = prismaDateToIso(openFy.startDate);
  const fyEnd = prismaDateToIso(openFy.endDate);
  const selectable = listSelectableCalendarMonths(fyStart, fyEnd);
  if (selectable.length === 0) {
    throw new Error("The open financial year has no selectable calendar months.");
  }
  const month =
    defaultSelectableMonthForToday(fyStart, fyEnd) ?? selectable[0]!;
  return { openFy, month, selectable };
}

function siteMonthNeedsReset(
  row: {
    workingCalendarYear: number | null;
    workingCalendarMonth: number | null;
    workingFinancialYear: number | null;
  },
  openFinancialYear: number,
  fyStart: string,
  fyEnd: string,
): boolean {
  if (
    row.workingCalendarYear == null ||
    row.workingCalendarMonth == null ||
    row.workingFinancialYear == null
  ) {
    return true;
  }
  if (row.workingFinancialYear !== openFinancialYear) return true;
  return !isCalendarMonthFullyInsideFy(
    row.workingCalendarYear,
    row.workingCalendarMonth,
    fyStart,
    fyEnd,
  );
}

/** Read site working month; lazy-init and FY rollover when unset or stale. */
export async function getSalesPointWorkingMonth(
  salesPointId: number,
): Promise<{
  salesPointId: number;
  salesPointName: string;
  financialYear: number;
  calendarYear: number;
  calendarMonth: number;
}> {
  const prisma = getPrismaClient();
  const { openFy, month, selectable } = await defaultMonthInOpenFy();
  const fyStart = prismaDateToIso(openFy.startDate);
  const fyEnd = prismaDateToIso(openFy.endDate);

  let row = await prisma.salesPoint.findUnique({
    where: { id: salesPointId },
    select: salesPointWorkingMonthSelect,
  });
  if (!row) throw new Error("Sales point not found.");

  if (siteMonthNeedsReset(row, openFy.financialYear, fyStart, fyEnd)) {
    row = await prisma.salesPoint.update({
      where: { id: salesPointId },
      data: {
        workingCalendarYear: month.year,
        workingCalendarMonth: month.month,
        workingFinancialYear: openFy.financialYear,
      },
      select: salesPointWorkingMonthSelect,
    });
  }

  const hit = pickSelectableMonth(
    selectable,
    row.workingCalendarYear!,
    row.workingCalendarMonth!,
  );
  const resolved = hit ?? month;

  return {
    salesPointId: row.id,
    salesPointName: row.name,
    financialYear: openFy.financialYear,
    calendarYear: resolved.year,
    calendarMonth: resolved.month,
  };
}

export async function setSalesPointWorkingMonth(
  session: AuthSession,
  salesPointId: number,
  calendarYear: number,
  calendarMonth: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await canSetSalesPointWorkingMonth(session, salesPointId))) {
    return {
      ok: false,
      error: "You do not have permission to set the working month for this sales point.",
    };
  }

  const openPeriod = await getOpenFinancialYearPeriod();
  if (!openPeriod) {
    return {
      ok: false,
      error: "No financial year is open. Open a year under Financial years first.",
    };
  }

  const open = toOpenFinancialYearForPosting(openPeriod);
  try {
    assertPostingPeriod(
      open,
      open.financialYear,
      calendarYear,
      calendarMonth,
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid working month.",
    };
  }

  const prisma = getPrismaClient();
  const exists = await prisma.salesPoint.findUnique({
    where: { id: salesPointId },
    select: { id: true },
  });
  if (!exists) return { ok: false, error: "Sales point not found." };

  await prisma.salesPoint.update({
    where: { id: salesPointId },
    data: {
      workingCalendarYear: calendarYear,
      workingCalendarMonth: calendarMonth,
      workingFinancialYear: open.financialYear,
      workingMonthSetAt: new Date(),
      workingMonthSetById: session.userId,
    },
  });

  return { ok: true };
}

/** Single entry point for server posting, reports, and client bootstrap. */
export async function resolveWorkingMonthForSession(
  session: AuthSession,
  cookieStore?: Pick<ReadonlyRequestCookies, "get">,
): Promise<ResolvedWorkingMonth | null> {
  const openPeriod = await getOpenFinancialYearPeriod();
  if (!openPeriod) return null;

  const fyStart = prismaDateToIso(openPeriod.startDate);
  const fyEnd = prismaDateToIso(openPeriod.endDate);
  const selectable = listSelectableCalendarMonths(fyStart, fyEnd);
  if (selectable.length === 0) return null;

  if (usesSalesPointWorkingMonth(session) && session.salesPoint) {
    const site = await getSalesPointWorkingMonth(session.salesPoint.id);
    const canChange = await canSetSalesPointWorkingMonth(
      session,
      session.salesPoint.id,
    );
    return {
      financialYear: site.financialYear,
      calendarYear: site.calendarYear,
      calendarMonth: site.calendarMonth,
      source: "sales_point",
      canChange,
      salesPointId: site.salesPointId,
      salesPointName: site.salesPointName,
    };
  }

  const store = cookieStore ?? (await cookies());
  const parsed = readWorkingCalCookie(store, session.userId);
  const fromCookie =
    parsed &&
    selectable.some((s) => s.year === parsed.year && s.month === parsed.month)
      ? parsed
      : null;
  const pick =
    fromCookie ??
    defaultSelectableMonthForToday(fyStart, fyEnd) ??
    selectable[0] ??
    null;
  if (!pick) return null;

  return {
    financialYear: openPeriod.financialYear,
    calendarYear: pick.year,
    calendarMonth: pick.month,
    source: "personal",
    canChange: true,
    salesPointId: null,
    salesPointName: null,
  };
}
