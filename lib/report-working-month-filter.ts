import { getServerSession } from "@/lib/auth-server";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { resolveWorkingMonthForSession } from "@/lib/sales-point-working-month";

export type ReportMonthFilter = {
  financialYear: number;
  postingCalendarYear: number;
  financialMonth: number;
  label: string;
};

export async function resolveReportWorkingMonthFilter(): Promise<{
  monthFilter: ReportMonthFilter | null;
  hasOpenFy: boolean;
}> {
  const openPeriod = await getOpenFinancialYearPeriod();
  if (!openPeriod) {
    return { monthFilter: null, hasOpenFy: false };
  }
  const session = await getServerSession();
  if (!session) {
    return { monthFilter: null, hasOpenFy: true };
  }

  const resolved = await resolveWorkingMonthForSession(session);
  if (!resolved) {
    return { monthFilter: null, hasOpenFy: true };
  }

  const label = new Date(
    Date.UTC(resolved.calendarYear, resolved.calendarMonth - 1, 1),
  ).toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
  });
  return {
    monthFilter: {
      financialYear: resolved.financialYear,
      postingCalendarYear: resolved.calendarYear,
      financialMonth: resolved.calendarMonth,
      label,
    },
    hasOpenFy: true,
  };
}
