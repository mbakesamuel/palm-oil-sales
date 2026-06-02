import { cookies } from "next/headers";
import { getServerSession } from "@/lib/auth-server";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import {
  defaultSelectableMonthForToday,
  listSelectableCalendarMonths,
  prismaDateToIso,
} from "@/lib/posting-calendar";
import { readWorkingCalCookie } from "@/lib/working-period-cookie";

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
  const fyStart = prismaDateToIso(openPeriod.startDate);
  const fyEnd = prismaDateToIso(openPeriod.endDate);
  const selectable = listSelectableCalendarMonths(fyStart, fyEnd);
  if (selectable.length === 0) {
    return { monthFilter: null, hasOpenFy: true };
  }

  const session = await getServerSession();
  const cookieStore = await cookies();
  const parsed = readWorkingCalCookie(cookieStore, session?.userId);
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
  if (!pick) {
    return { monthFilter: null, hasOpenFy: true };
  }
  const label = new Date(Date.UTC(pick.year, pick.month - 1, 1)).toLocaleString(
    "en-GB",
    {
      month: "short",
      year: "numeric",
    },
  );
  return {
    monthFilter: {
      financialYear: openPeriod.financialYear,
      postingCalendarYear: pick.year,
      financialMonth: pick.month,
      label,
    },
    hasOpenFy: true,
  };
}
