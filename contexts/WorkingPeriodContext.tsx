"use client";

import * as React from "react";
import {
  fiscalPeriodForDate,
  formatFinancialYearLabel,
  formatFiscalMonthCalendarLabel,
} from "@/lib/fiscal";

const STORAGE_KEY = "po_working_period";

export type WorkingPeriodContextValue = {
  openFinancialYear: number | null;
  fiscalYearStartMonth: number;
  workingMonth: number;
  setWorkingMonth: (m: number) => void;
  fyLabel: string;
  workingMonthLabel: string;
};

const WorkingPeriodContext = React.createContext<WorkingPeriodContextValue | null>(null);

export function WorkingPeriodProvider(props: {
  children: React.ReactNode;
  openFinancialYear: number | null;
  fiscalYearStartMonth: number;
}) {
  const { children, openFinancialYear, fiscalYearStartMonth } = props;
  const [workingMonth, setWorkingMonthState] = React.useState(1);

  const applyDefaultMonth = React.useCallback(() => {
    if (openFinancialYear == null) {
      setWorkingMonthState(1);
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw) as { financialYear?: unknown; financialMonth?: unknown };
        if (
          o.financialYear === openFinancialYear &&
          typeof o.financialMonth === "number" &&
          o.financialMonth >= 1 &&
          o.financialMonth <= 12
        ) {
          setWorkingMonthState(o.financialMonth);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    const p = fiscalPeriodForDate(new Date(), fiscalYearStartMonth);
    const m = p.financialYear === openFinancialYear ? p.financialMonth : 1;
    setWorkingMonthState(m);
  }, [openFinancialYear, fiscalYearStartMonth]);

  React.useEffect(() => {
    applyDefaultMonth();
  }, [applyDefaultMonth]);

  function setWorkingMonth(m: number) {
    const clamped = Math.min(12, Math.max(1, Math.round(m)));
    setWorkingMonthState(clamped);
    if (openFinancialYear != null) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ financialYear: openFinancialYear, financialMonth: clamped }),
        );
      } catch {
        /* ignore */
      }
    }
  }

  const fyLabel =
    openFinancialYear != null
      ? formatFinancialYearLabel(openFinancialYear, fiscalYearStartMonth)
      : "—";

  const workingMonthLabel =
    openFinancialYear != null
      ? `Month ${workingMonth} · ${formatFiscalMonthCalendarLabel(
          openFinancialYear,
          workingMonth,
          fiscalYearStartMonth,
        )}`
      : "—";

  const value = React.useMemo(
    () => ({
      openFinancialYear,
      fiscalYearStartMonth,
      workingMonth,
      setWorkingMonth,
      fyLabel,
      workingMonthLabel,
    }),
    [openFinancialYear, fiscalYearStartMonth, workingMonth, fyLabel, workingMonthLabel],
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
