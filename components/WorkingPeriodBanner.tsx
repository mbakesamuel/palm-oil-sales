"use client";

import Link from "next/link";
import { useWorkingPeriod } from "@/contexts/WorkingPeriodContext";

export function WorkingPeriodBanner() {
  const wp = useWorkingPeriod();

  if (wp.openFinancialYear == null) {
    return (
      <div className="mb-4 rounded-lg border border-amber-600/40 bg-amber-600/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 print:hidden">
        <span className="font-medium">No financial year is open.</span> Sales and delivery orders
        cannot be posted until an admin or manager opens a year under{" "}
        <Link href="/financial-years" className="underline underline-offset-4">
          Financial years
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-black/10 dark:border-white/10 px-4 py-3 text-sm print:hidden sm:flex-row sm:items-center sm:justify-between">
      <div>
        <span className="opacity-70">Your posting period</span>{" "}
        <span className="font-medium tabular-nums">{wp.fyLabel}</span>
        <span className="opacity-70"> · </span>
        <span className="font-medium">{wp.workingMonthLabel}</span>
      </div>
      <Link
        href="/financial-years"
        className="text-xs underline underline-offset-4 opacity-80 hover:opacity-100 shrink-0"
      >
        Change working month
      </Link>
    </div>
  );
}
