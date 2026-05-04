/** Cookie set from `WorkingPeriodContext` so server routes can read the user's working calendar month. */
export const WORKING_CAL_COOKIE = "po_working_cal";

/** Value format: `YYYY-M` (calendar month 1–12). */
export function parseWorkingCalCookie(raw: string | undefined): { year: number; month: number } | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}
