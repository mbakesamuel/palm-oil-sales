"use client";

import * as React from "react";
import {
  defaultSelectableMonthForToday,
  firstDayOfCalendarMonth,
  lastDayOfCalendarMonth,
  listSelectableCalendarMonths,
  type SelectableMonth,
} from "@/lib/posting-calendar";

const STORAGE_KEY = "po_working_period";

export type WorkingPeriodContextValue = {
  openFinancialYear: number | null;
  openPeriodStartIso: string | null;
  openPeriodEndIso: string | null;
  selectableMonths: SelectableMonth[];
  workingCalendarYear: number;
  workingCalendarMonth: number;
  setWorkingCalendarMonth: (year: number, month: number) => void;
  fyLabel: string;
  workingMonthLabel: string;
};

const WorkingPeriodContext = React.createContext<WorkingPeriodContextValue | null>(null);

export function WorkingPeriodProvider(props: {
  children: React.ReactNode;
  openFinancialYear: number | null;
  openPeriodStartIso: string | null;
  openPeriodEndIso: string | null;
}) {
  const { children, openFinancialYear, openPeriodStartIso, openPeriodEndIso } = props;

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

  const applyDefaultMonth = React.useCallback(() => {
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw) as {
          financialYear?: unknown;
          calendarYear?: unknown;
          calendarMonth?: unknown;
        };
        const cy = o.calendarYear;
        const cm = o.calendarMonth;
        if (
          o.financialYear === openFinancialYear &&
          typeof cy === "number" &&
          typeof cm === "number"
        ) {
          const ok = selectableMonths.some((r) => r.year === cy && r.month === cm);
          if (ok) {
            setWorkingCalYear(cy);
            setWorkingCalMonth(cm);
            return;
          }
        }
      }
    } catch {
      /* ignore */
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
  }, [openFinancialYear, openPeriodStartIso, openPeriodEndIso, selectableMonths]);

  React.useEffect(() => {
    applyDefaultMonth();
  }, [applyDefaultMonth]);

  function setWorkingCalendarMonth(year: number, month: number) {
    setWorkingCalYear(year);
    setWorkingCalMonth(month);
    if (openFinancialYear != null) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            financialYear: openFinancialYear,
            calendarYear: year,
            calendarMonth: month,
          }),
        );
      } catch {
        /* ignore */
      }
    }
  }

  const fyLabel =
    openFinancialYear != null && openPeriodStartIso != null && openPeriodEndIso != null
      ? `${openFinancialYear} (${openPeriodStartIso} → ${openPeriodEndIso})`
      : "—";

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
