"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { WorkingPeriodBanner } from "@/components/WorkingPeriodBanner";
import { isDashboardPath } from "@/lib/dashboard-routing";

export function AppShellMainSection({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDashboard = isDashboardPath(pathname);

  return (
    <section
      className={[
        "min-w-0 flex min-h-0 flex-1 flex-col print:w-full print:overflow-visible",
        isDashboard ? "h-full gap-0" : "gap-3",
      ].join(" ")}
    >
      {!isDashboard ? (
        <div className="shrink-0 print:hidden">
          <WorkingPeriodBanner />
        </div>
      ) : null}
      <div
        className={[
          "min-h-0 flex-1 print:overflow-visible",
          isDashboard
            ? "h-full min-h-0 overflow-hidden p-0"
            : "overflow-y-auto rounded-2xl border border-border p-4 sm:p-6 print:border-0 print:shadow-none print:p-0 print:rounded-none",
        ].join(" ")}
      >
        {children}
      </div>
    </section>
  );
}
