/**
 * Financial year is the calendar year in which the fiscal year *starts*.
 * Example: fiscal year start month = July → Jul 2024–Jun 2025 → financialYear = 2024, months 1–12.
 */
export function fiscalPeriodForDate(
  d: Date,
  fiscalYearStartMonth: number,
): { financialYear: number; financialMonth: number } {
  const sm = fiscalYearStartMonth;
  if (sm < 1 || sm > 12) {
    throw new Error("Fiscal year start month must be between 1 and 12.");
  }

  const m = d.getMonth() + 1;
  const y = d.getFullYear();

  if (sm === 1) {
    return { financialYear: y, financialMonth: m };
  }

  if (m >= sm) {
    return { financialYear: y, financialMonth: m - sm + 1 };
  }

  return { financialYear: y - 1, financialMonth: 12 - sm + 1 + m };
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
