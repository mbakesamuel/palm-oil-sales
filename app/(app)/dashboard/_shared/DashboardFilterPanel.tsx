"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { sessionRoleLabel } from "@/lib/auth-display";
import { useWorkingPeriod } from "@/contexts/WorkingPeriodContext";
import type { DashboardMonthFilter } from "@/lib/dashboard/types";
import type { DashboardQuickLink } from "@/lib/dashboard-widgets";

function FilterBlock(props: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border bg-background p-1.5 shadow-sm sm:p-2">
      <div className="shrink-0 text-[9px] font-semibold uppercase tracking-wide opacity-70 sm:text-[10px]">
        {props.title}
      </div>
      <div className="mt-0.5 min-h-0 overflow-hidden text-[10px] sm:text-xs">{props.children}</div>
    </div>
  );
}

export function DashboardFilterPanel(props: {
  monthFilter: DashboardMonthFilter | null;
  hasOpenFy: boolean;
  scopeLabel?: string;
  quickLinks?: DashboardQuickLink[];
}) {
  const wp = useWorkingPeriod();
  const { status, session } = useAuth();
  const { monthFilter, hasOpenFy, scopeLabel, quickLinks = [] } = props;

  return (
    <>
      {status === "ready" && session ? (
        <FilterBlock title="Signed in">
          <p className="truncate font-medium">{session.displayName}</p>
          <p className="truncate opacity-70">@{session.username}</p>
          <p className="truncate opacity-80">{sessionRoleLabel(session)}</p>
        </FilterBlock>
      ) : null}

      <FilterBlock title="Report period">
        {!hasOpenFy ? (
          <p className="text-amber-800 dark:text-amber-200">No financial year open.</p>
        ) : monthFilter ? (
          <div className="space-y-0.5">
            <div className="truncate">
              <span className="opacity-70">Month:</span>{" "}
              <span className="font-medium">{monthFilter.label}</span>
            </div>
            <div className="truncate">
              <span className="opacity-70">FY:</span>{" "}
              <span className="font-medium tabular-nums">{monthFilter.financialYear}</span>
            </div>
          </div>
        ) : (
          <p className="opacity-70">Working month not set.</p>
        )}
        <Link
          href="/financial-years"
          className="mt-0.5 inline-block font-medium text-brand underline underline-offset-2"
        >
          Change month
        </Link>
      </FilterBlock>

      {scopeLabel ? (
        <FilterBlock title="Scope">
          <p className="truncate font-medium">{scopeLabel}</p>
        </FilterBlock>
      ) : null}

      <FilterBlock title="Posting period">
        <p className="truncate">{wp.workingMonthLabel || "—"}</p>
      </FilterBlock>

      {quickLinks.length > 0 ? (
        <FilterBlock title="Quick links">
          <ul className="space-y-0.5">
            {quickLinks.slice(0, 4).map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block truncate text-brand hover:underline underline-offset-2"
                >
                  {link.title}
                </Link>
              </li>
            ))}
          </ul>
        </FilterBlock>
      ) : null}
    </>
  );
}
