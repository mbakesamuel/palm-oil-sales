import type { AuthSession } from "@/lib/auth-session";
import { getServerSession } from "@/lib/auth-server";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import {
  listSelectableCalendarMonths,
  prismaDateToIso,
  type SelectableMonth,
} from "@/lib/posting-calendar";
import { resolveWorkingMonthForSession } from "@/lib/sales-point-working-month";

export type ReportMonthFilter = {
  financialYear: number;
  postingCalendarYear: number;
  financialMonth: number;
  label: string;
};

export type ReportMonthSnapshot = {
  year: number;
  month: number;
  label: string;
};

function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function toMonthFilter(
  financialYear: number,
  calendarYear: number,
  calendarMonth: number,
): ReportMonthFilter {
  return {
    financialYear,
    postingCalendarYear: calendarYear,
    financialMonth: calendarMonth,
    label: monthLabel(calendarYear, calendarMonth),
  };
}

function toMonthSnapshot(year: number, month: number): ReportMonthSnapshot {
  return { year, month, label: monthLabel(year, month) };
}

export type ResolveReportMonthFilterResult = {
  monthFilter: ReportMonthFilter | null;
  hasOpenFy: boolean;
  monthInvalid: boolean;
  selectableMonths: SelectableMonth[];
  workingMonth: ReportMonthSnapshot | null;
};

export async function resolveReportMonthFilter(
  session: AuthSession,
  opts?: { calendarYear?: number; calendarMonth?: number },
): Promise<ResolveReportMonthFilterResult> {
  const openPeriod = await getOpenFinancialYearPeriod();
  if (!openPeriod) {
    return {
      monthFilter: null,
      hasOpenFy: false,
      monthInvalid: false,
      selectableMonths: [],
      workingMonth: null,
    };
  }

  const fyStart = prismaDateToIso(openPeriod.startDate);
  const fyEnd = prismaDateToIso(openPeriod.endDate);
  const selectableMonths = listSelectableCalendarMonths(fyStart, fyEnd);

  const resolvedWorking = await resolveWorkingMonthForSession(session);
  const workingMonth = resolvedWorking
    ? toMonthSnapshot(resolvedWorking.calendarYear, resolvedWorking.calendarMonth)
    : null;

  const hasOverride =
    opts?.calendarYear != null &&
    Number.isFinite(opts.calendarYear) &&
    opts?.calendarMonth != null &&
    Number.isFinite(opts.calendarMonth);

  if (hasOverride) {
    const year = opts!.calendarYear!;
    const month = opts!.calendarMonth!;
    const hit = selectableMonths.find((s) => s.year === year && s.month === month);
    if (!hit) {
      return {
        monthFilter: null,
        hasOpenFy: true,
        monthInvalid: true,
        selectableMonths,
        workingMonth,
      };
    }
    const financialYear = openPeriod.financialYear;
    return {
      monthFilter: toMonthFilter(financialYear, year, month),
      hasOpenFy: true,
      monthInvalid: false,
      selectableMonths,
      workingMonth,
    };
  }

  if (!resolvedWorking) {
    return {
      monthFilter: null,
      hasOpenFy: true,
      monthInvalid: false,
      selectableMonths,
      workingMonth: null,
    };
  }

  return {
    monthFilter: toMonthFilter(
      resolvedWorking.financialYear,
      resolvedWorking.calendarYear,
      resolvedWorking.calendarMonth,
    ),
    hasOpenFy: true,
    monthInvalid: false,
    selectableMonths,
    workingMonth,
  };
}

export async function resolveReportWorkingMonthFilter(): Promise<{
  monthFilter: ReportMonthFilter | null;
  hasOpenFy: boolean;
}> {
  const session = await getServerSession();
  if (!session) {
    const openPeriod = await getOpenFinancialYearPeriod();
    return { monthFilter: null, hasOpenFy: Boolean(openPeriod) };
  }
  const result = await resolveReportMonthFilter(session);
  return {
    monthFilter: result.monthFilter,
    hasOpenFy: result.hasOpenFy,
  };
}
