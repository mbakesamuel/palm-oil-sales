import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

/** @deprecated Legacy global cookie; do not write. Cleared on logout. */
export const WORKING_CAL_COOKIE = "po_working_cal";

/** Per-user working calendar month cookie (set from `WorkingPeriodContext`). */
export function workingCalCookieName(userId: string): string {
  return `po_working_cal_u_${userId}`;
}

/** Value format: `YYYY-M` (calendar month 1–12). */
export function parseWorkingCalCookie(
  raw: string | undefined,
): { year: number; month: number } | null {
  if (!raw) return null;
  const s = raw.trim();
  const m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export function formatWorkingCalCookieValue(year: number, month: number): string {
  return `${year}-${month}`;
}

/** Prefer the signed-in user's cookie; ignore the legacy global cookie when user id is known. */
export function readWorkingCalCookie(
  cookieStore: Pick<ReadonlyRequestCookies, "get">,
  userId: string | null | undefined,
): { year: number; month: number } | null {
  if (userId) {
    const forUser = parseWorkingCalCookie(
      cookieStore.get(workingCalCookieName(userId))?.value,
    );
    if (forUser) return forUser;
  }
  if (!userId) {
    return parseWorkingCalCookie(cookieStore.get(WORKING_CAL_COOKIE)?.value);
  }
  return null;
}

/** Clear working-month cookies in the browser (call on sign-out). */
export function clearWorkingCalCookiesClient(userId: string | null | undefined): void {
  if (typeof document === "undefined") return;
  const base = "path=/; max-age=0; SameSite=Lax";
  document.cookie = `${WORKING_CAL_COOKIE}=; ${base}`;
  if (userId) {
    document.cookie = `${workingCalCookieName(userId)}=; ${base}`;
  }
}
