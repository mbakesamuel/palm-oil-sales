/**
 * Financial year is the calendar year in which the fiscal year *starts*.
 * Example: fiscal year start month = July → Jul 2024–Jun 2025 → financialYear = 2024, months 1–12.
 */
/**
 * Map a calendar month (timezone-neutral wall calendar) to fiscal year label and fiscal month 1–12.
 */
export function fiscalPeriodForCalendarMonth(
  calendarYear: number,
  calendarMonth1to12: number,
  fiscalYearStartMonth: number,
): { financialYear: number; financialMonth: number } {
  const sm = fiscalYearStartMonth;
  if (sm < 1 || sm > 12) {
    throw new Error("Fiscal year start month must be between 1 and 12.");
  }
  const m = calendarMonth1to12;
  const y = calendarYear;
  if (m < 1 || m > 12) {
    throw new Error("Calendar month must be between 1 and 12.");
  }

  if (sm === 1) {
    return { financialYear: y, financialMonth: m };
  }

  if (m >= sm) {
    return { financialYear: y, financialMonth: m - sm + 1 };
  }

  return { financialYear: y - 1, financialMonth: 12 - sm + 1 + m };
}

export function fiscalPeriodForDate(
  d: Date,
  fiscalYearStartMonth: number,
): { financialYear: number; financialMonth: number } {
  return fiscalPeriodForCalendarMonth(
    d.getFullYear(),
    d.getMonth() + 1,
    fiscalYearStartMonth,
  );
}

/** End calendar year of the financial year (for labels). */
export function financialYearEndCalendarYear(
  financialYear: number,
  fiscalYearStartMonth: number,
): number {
  if (fiscalYearStartMonth <= 1) return financialYear;
  return financialYear + 1;
}

/** e.g. start Jan → "2026"; start Jul → "2024–25" */
export function formatFinancialYearLabel(
  financialYear: number,
  fiscalYearStartMonth: number,
): string {
  if (fiscalYearStartMonth <= 1) return String(financialYear);
  const endY = financialYearEndCalendarYear(financialYear, fiscalYearStartMonth);
  return `${financialYear}–${String(endY).slice(-2)}`;
}

export function monthName(month1To12: number): string {
  if (month1To12 < 1 || month1To12 > 12) return "";
  return new Date(2000, month1To12 - 1, 1).toLocaleString("en-GB", { month: "long" });
}

/** Calendar month/year for fiscal month `financialMonth` (1–12) within `financialYear`. */
export function calendarMonthForFiscalMonth(
  financialYear: number,
  financialMonth: number,
  fiscalYearStartMonth: number,
): { month: number; year: number } {
  if (financialMonth < 1 || financialMonth > 12) {
    throw new Error("Financial month must be between 1 and 12.");
  }
  let calMonth = fiscalYearStartMonth + (financialMonth - 1);
  let calYear = financialYear;
  while (calMonth > 12) {
    calMonth -= 12;
    calYear += 1;
  }
  return { month: calMonth, year: calYear };
}

/** Short label e.g. "Mar 2025" for the calendar month tied to a fiscal month. */
export function formatFiscalMonthCalendarLabel(
  financialYear: number,
  financialMonth: number,
  fiscalYearStartMonth: number,
): string {
  const { month, year } = calendarMonthForFiscalMonth(
    financialYear,
    financialMonth,
    fiscalYearStartMonth,
  );
  return new Date(year, month - 1, 1).toLocaleString("en-GB", { month: "short", year: "numeric" });
}
