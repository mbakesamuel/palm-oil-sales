/**
 * Calendar-based posting periods: ISO dates as YYYY-MM-DD (UTC calendar day).
 */

export type IsoDate = string;

export function prismaDateToIso(d: Date): IsoDate {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getUTCFullYear();
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const day = String(x.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function utcIsoDateToday(): IsoDate {
  const n = new Date();
  return prismaDateToIso(n);
}

export function normalizeIsoDateInput(raw: string): IsoDate | null {
  const s = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export function firstDayOfCalendarMonth(year: number, month1to12: number): IsoDate {
  return `${year}-${String(month1to12).padStart(2, "0")}-01`;
}

export function lastDayOfCalendarMonth(year: number, month1to12: number): IsoDate {
  const mi = month1to12 - 1;
  const last = new Date(Date.UTC(year, mi + 1, 0));
  const d = last.getUTCDate();
  return `${year}-${String(month1to12).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Full calendar month [first, last] lies inside [fyStart, fyEnd] inclusive. */
export function isCalendarMonthFullyInsideFy(
  calendarYear: number,
  calendarMonth: number,
  fyStart: IsoDate,
  fyEnd: IsoDate,
): boolean {
  const fd = firstDayOfCalendarMonth(calendarYear, calendarMonth);
  const ld = lastDayOfCalendarMonth(calendarYear, calendarMonth);
  return fd >= fyStart && ld <= fyEnd;
}

export type SelectableMonth = { year: number; month: number; label: string };

export function listSelectableCalendarMonths(
  fyStart: IsoDate,
  fyEnd: IsoDate,
): SelectableMonth[] {
  const out: SelectableMonth[] = [];
  const startParts = fyStart.split("-").map((x) => Number.parseInt(x, 10));
  const y0 = startParts[0]!;
  const m0 = startParts[1]!;
  let y = y0;
  let m = m0;
  for (let guard = 0; guard < 600; guard++) {
    const fd = firstDayOfCalendarMonth(y, m);
    if (fd > fyEnd) break;
    const ld = lastDayOfCalendarMonth(y, m);
    if (fd >= fyStart && ld <= fyEnd) {
      const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
        month: "short",
        year: "numeric",
      });
      out.push({ year: y, month: m, label });
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function defaultSelectableMonthForToday(
  fyStart: IsoDate,
  fyEnd: IsoDate,
): SelectableMonth | null {
  const list = listSelectableCalendarMonths(fyStart, fyEnd);
  if (list.length === 0) return null;
  const today = utcIsoDateToday();
  for (const row of list) {
    const fd = firstDayOfCalendarMonth(row.year, row.month);
    const ld = lastDayOfCalendarMonth(row.year, row.month);
    if (today >= fd && today <= ld) return row;
  }
  return list[0] ?? null;
}

export function assertIsoDateWithinWorkingCalendarMonth(
  docIso: IsoDate,
  fyStart: IsoDate,
  fyEnd: IsoDate,
  calendarYear: number,
  calendarMonth: number,
): void {
  if (!isCalendarMonthFullyInsideFy(calendarYear, calendarMonth, fyStart, fyEnd)) {
    throw new Error("Working calendar month is not fully inside the open financial year.");
  }
  const fd = firstDayOfCalendarMonth(calendarYear, calendarMonth);
  const ld = lastDayOfCalendarMonth(calendarYear, calendarMonth);
  if (docIso < fd || docIso > ld) {
    throw new Error(
      `Transaction date must fall within the working calendar month (${fd}–${ld}).`,
    );
  }
}

export function noonUtcFromIsoDate(iso: IsoDate): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

/** Start of the UTC calendar day after `iso` (use as exclusive upper bound for “on or before iso”). */
export function utcInstantAfterIsoDate(iso: IsoDate): Date {
  const parts = iso.split("-").map((x) => Number.parseInt(x, 10));
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  return new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
}
