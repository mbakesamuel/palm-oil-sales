"use client";

import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  defaultSelectableMonthForToday,
  firstDayOfCalendarMonth,
  lastDayOfCalendarMonth,
  listSelectableCalendarMonths,
  type SelectableMonth,
} from "@/lib/posting-calendar";
import {
  formatWorkingCalCookieValue,
  workingCalCookieName,
} from "@/lib/working-period-cookie";

const STORAGE_KEY = "po_working_period_v2";

type StoredByUser = Record<string, { calendarYear: number; calendarMonth: number }>;

export type WorkingPeriodContextValue = {
  openFinancialYear: number | null;
  openPeriodStartIso: string | null;
  openPeriodEndIso: string | null;
  selectableMonths: SelectableMonth[];
  workingCalendarYear: number;
  workingCalendarMonth: number;
  workingMonthStartIso: string | null;
  workingMonthEndIso: string | null;
  setWorkingCalendarMonth: (year: number, month: number) => void;
  fyLabel: string;
  workingMonthLabel: string;
};

const WorkingPeriodContext = React.createContext<WorkingPeriodContextValue | null>(null);

function readStoredMonth(
  financialYear: number,
  userId: string | null,
): { calendarYear: number; calendarMonth: number } | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as {
      financialYear?: unknown;
      byUser?: unknown;
    };
    if (o.financialYear !== financialYear || typeof o.byUser !== "object" || !o.byUser) {
      return null;
    }
    const entry = (o.byUser as StoredByUser)[userId];
    if (
      entry &&
      typeof entry.calendarYear === "number" &&
      typeof entry.calendarMonth === "number"
    ) {
      return {
        calendarYear: entry.calendarYear,
        calendarMonth: entry.calendarMonth,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredMonth(
  financialYear: number,
  userId: string,
  calendarYear: number,
  calendarMonth: number,
): void {
  try {
    let byUser: StoredByUser = {};
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw) as {
        financialYear?: unknown;
        byUser?: unknown;
      };
      if (o.financialYear === financialYear && typeof o.byUser === "object" && o.byUser) {
        byUser = { ...(o.byUser as StoredByUser) };
      }
    }
    byUser[userId] = { calendarYear, calendarMonth };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ financialYear, byUser }));
  } catch {
    /* ignore */
  }
}

export function WorkingPeriodProvider(props: {
  children: React.ReactNode;
  openFinancialYear: number | null;
  openPeriodStartIso: string | null;
  openPeriodEndIso: string | null;
}) {
  const { children, openFinancialYear, openPeriodStartIso, openPeriodEndIso } = props;
  const { status: authStatus, session } = useAuth();
  const userId = session?.userId ?? null;

  const selectableMonths = React.useMemo(() => {
    if (
      openFinancialYear == null ||
      openPeriodStartIso == null ||
      openPeriodEndIso == null
    ) {
      return [];
    }
    return listSelectableCalendarMonths(openPeriodStartIso, openPeriodEndIso);
  }, [openFinancialYear, openPeriodStartIso, openPeriodEndIso]);

  const [workingCalYear, setWorkingCalYear] = React.useState(2000);
  const [workingCalMonth, setWorkingCalMonth] = React.useState(1);

  const applyMonthForUser = React.useCallback(() => {
    if (
      openFinancialYear == null ||
      openPeriodStartIso == null ||
      openPeriodEndIso == null ||
      selectableMonths.length === 0
    ) {
      setWorkingCalYear(2000);
      setWorkingCalMonth(1);
      return;
    }

    if (authStatus === "loading") return;

    if (userId) {
      const stored = readStoredMonth(openFinancialYear, userId);
      if (stored) {
        const ok = selectableMonths.some(
          (r) => r.year === stored.calendarYear && r.month === stored.calendarMonth,
        );
        if (ok) {
          setWorkingCalYear(stored.calendarYear);
          setWorkingCalMonth(stored.calendarMonth);
          return;
        }
      }
    }

    const d = defaultSelectableMonthForToday(openPeriodStartIso, openPeriodEndIso);
    if (d) {
      setWorkingCalYear(d.year);
      setWorkingCalMonth(d.month);
      return;
    }
    const f = selectableMonths[0];
    if (f) {
      setWorkingCalYear(f.year);
      setWorkingCalMonth(f.month);
    }
  }, [
    authStatus,
    userId,
    openFinancialYear,
    openPeriodStartIso,
    openPeriodEndIso,
    selectableMonths,
  ]);

  React.useEffect(() => {
    applyMonthForUser();
  }, [applyMonthForUser]);

  React.useEffect(() => {
    if (openFinancialYear == null || !userId) return;
    const ok = selectableMonths.some(
      (m) => m.year === workingCalYear && m.month === workingCalMonth,
    );
    if (!ok) return;
    const maxAge = 60 * 60 * 24 * 400;
    const value = formatWorkingCalCookieValue(workingCalYear, workingCalMonth);
    document.cookie = `${workingCalCookieName(userId)}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }, [
    openFinancialYear,
    selectableMonths,
    workingCalYear,
    workingCalMonth,
    userId,
  ]);

  const setWorkingCalendarMonth = React.useCallback(
    (year: number, month: number) => {
      setWorkingCalYear(year);
      setWorkingCalMonth(month);
      if (openFinancialYear != null && userId) {
        writeStoredMonth(openFinancialYear, userId, year, month);
      }
    },
    [openFinancialYear, userId],
  );

  const fyLabel =
    openFinancialYear != null && openPeriodStartIso != null && openPeriodEndIso != null
      ? `${openFinancialYear} (${openPeriodStartIso} → ${openPeriodEndIso})`
      : "—";

  const workingMonthStartEnd = React.useMemo(() => {
    if (openFinancialYear == null || selectableMonths.length === 0) {
      return { startIso: null as string | null, endIso: null as string | null };
    }
    const { minIso, maxIso } = workingMonthDateBounds(workingCalYear, workingCalMonth);
    return { startIso: minIso, endIso: maxIso };
  }, [openFinancialYear, selectableMonths.length, workingCalYear, workingCalMonth]);

  const workingMonthLabel =
    openFinancialYear != null && selectableMonths.length > 0
      ? (() => {
          const hit = selectableMonths.find(
            (m) => m.year === workingCalYear && m.month === workingCalMonth,
          );
          return hit ? `Calendar · ${hit.label}` : "—";
        })()
      : "—";

  const value = React.useMemo(
    () => ({
      openFinancialYear,
      openPeriodStartIso,
      openPeriodEndIso,
      selectableMonths,
      workingCalendarYear: workingCalYear,
      workingCalendarMonth: workingCalMonth,
      workingMonthStartIso: workingMonthStartEnd.startIso,
      workingMonthEndIso: workingMonthStartEnd.endIso,
      setWorkingCalendarMonth,
      fyLabel,
      workingMonthLabel,
    }),
    [
      openFinancialYear,
      openPeriodStartIso,
      openPeriodEndIso,
      selectableMonths,
      workingCalYear,
      workingCalMonth,
      workingMonthStartEnd.startIso,
      workingMonthStartEnd.endIso,
      setWorkingCalendarMonth,
      fyLabel,
      workingMonthLabel,
    ],
  );

  return <WorkingPeriodContext.Provider value={value}>{children}</WorkingPeriodContext.Provider>;
}

export function useWorkingPeriod(): WorkingPeriodContextValue {
  const ctx = React.useContext(WorkingPeriodContext);
  if (!ctx) {
    throw new Error("useWorkingPeriod must be used within WorkingPeriodProvider");
  }
  return ctx;
}

export function workingMonthDateBounds(
  year: number,
  month: number,
): { minIso: string; maxIso: string } {
  return {
    minIso: firstDayOfCalendarMonth(year, month),
    maxIso: lastDayOfCalendarMonth(year, month),
  };
}
