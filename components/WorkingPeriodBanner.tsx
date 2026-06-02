"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkingPeriod } from "@/contexts/WorkingPeriodContext";
import { isDashboardPath } from "@/lib/dashboard-routing";

export function WorkingPeriodBanner() {
  const pathname = usePathname();
  const wp = useWorkingPeriod();

  if (isDashboardPath(pathname)) {
    return null;
  }

  if (wp.openFinancialYear == null) {
    return (
      <div className="rounded-lg border border-accent/60 bg-accent/35 px-4 py-3 text-sm text-foreground print:hidden">
        <span className="font-medium">No financial year is open.</span> Sales and delivery orders
        cannot be posted until an admin or manager opens a year under{" "}
        <Link
          href="/financial-years"
          className="font-medium text-brand underline underline-offset-4 hover:opacity-90"
        >
          Financial years
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-accent/50 bg-accent/20 px-4 py-3 text-sm text-foreground print:hidden sm:flex-row sm:items-center sm:justify-between">
      <div>
        <span className="opacity-80">Financial year (Posting period):</span>{" "}
        <span className="font-medium tabular-nums">{wp.fyLabel}</span>
        <span className="opacity-80"> · </span>
        <span className="font-medium">{wp.workingMonthLabel}</span>
        {wp.workingMonthStartIso && wp.workingMonthEndIso ? (
          <span className="opacity-80">
            {" "}
            ({wp.workingMonthStartIso}–{wp.workingMonthEndIso})
          </span>
        ) : null}
      </div>
      <Link
        href="/financial-years"
        className="text-xs font-medium text-brand underline underline-offset-4 hover:opacity-90 shrink-0"
      >
        Change working month
      </Link>
    </div>
  );
}
