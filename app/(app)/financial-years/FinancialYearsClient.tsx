"use client";

import * as React from "react";
import { UserRole } from "@prisma/client";
import type { FinancialYearPeriod } from "@prisma/client";
import { FinancialYearStatus } from "@prisma/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkingPeriod } from "@/contexts/WorkingPeriodContext";
import {
  formatFinancialYearLabel,
  formatFiscalMonthCalendarLabel,
  monthName,
} from "@/lib/fiscal";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function FinancialYearsClient(props: {
  periods: FinancialYearPeriod[];
  fiscalYearStartMonth: number;
  openFinancialYearPeriodAction: (formData: FormData) => void;
  closeFinancialYearPeriodAction: (formData: FormData) => void;
}) {
  const {
    periods,
    fiscalYearStartMonth,
    openFinancialYearPeriodAction,
    closeFinancialYearPeriodAction,
  } = props;

  const { status, session } = useAuth();
  const wp = useWorkingPeriod();

  const canManage =
    status === "ready" &&
    session != null &&
    (session.role === UserRole.ADMIN || session.role === UserRole.MANAGER);

  const [yearToOpen, setYearToOpen] = React.useState(() => String(new Date().getFullYear()));
  const [pendingClose, setPendingClose] = React.useState<{
    id: string;
    financialYear: number;
  } | null>(null);

  const openRow = periods.find((p) => p.status === FinancialYearStatus.OPEN);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Financial years</h1>
        <p className="text-sm opacity-75">
          Only one financial year can be <span className="font-medium">open</span> at a time.
          <span className="font-medium"> Admin and manager</span> open and close the year (global
          calendar). Everyone chooses a <span className="font-medium">working month</span> (1–12
          within that year) for posting sales and delivery orders.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Your working month</h2>
        <p className="text-sm opacity-80">
          Open year:{" "}
          {wp.openFinancialYear != null ? (
            <span className="font-medium tabular-nums">
              FY {wp.fyLabel} (fiscal month 1 starts in{" "}
              <span className="font-medium">{monthName(fiscalYearStartMonth)}</span> per company setup)
            </span>
          ) : (
            <span className="font-medium text-amber-800 dark:text-amber-200/90">None — open a year below</span>
          )}
        </p>
        {wp.openFinancialYear != null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const active = m === wp.workingMonth;
              const label = formatFiscalMonthCalendarLabel(
                wp.openFinancialYear!,
                m,
                fiscalYearStartMonth,
              );
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => wp.setWorkingMonth(m)}
                  className={[
                    "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5",
                  ].join(" ")}
                >
                  <div className="font-medium tabular-nums">Month {m}</div>
                  <div className="text-xs opacity-80">{label}</div>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      {canManage ? (
        <section className="space-y-4 rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Financial year calendar (admin / manager)</h2>
          <p className="text-sm opacity-75">
            <span className="font-medium">Financial year</span> is the calendar year in which the
            period <span className="font-medium">starts</span> (same rule as elsewhere in the app).
            Close the current year before opening another.
          </p>

          <form action={openFinancialYearPeriodAction} className="flex flex-wrap items-end gap-3 max-w-xl">
            <input type="hidden" name="userRole" value={session!.role} />
            <div className="grid gap-1 flex-1 min-w-[140px]">
              <label className="text-sm font-medium" htmlFor="fy-open-year">
                Open financial year (start year)
              </label>
              <input
                id="fy-open-year"
                name="financialYear"
                type="number"
                min={1900}
                max={2100}
                value={yearToOpen}
                onChange={(e) => setYearToOpen(e.target.value)}
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                required
              />
            </div>
            <button
              type="submit"
              disabled={openRow != null}
              className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Open year
            </button>
          </form>
          {openRow != null ? (
            <p className="text-xs opacity-70">
              Close <span className="font-medium tabular-nums">{openRow.financialYear}</span> before
              opening a new one.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-lg border border-black/10 dark:border-white/10 p-4 text-sm opacity-80">
          Only <span className="font-medium">admin</span> or <span className="font-medium">manager</span>{" "}
          can open or close financial years.
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">All periods</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-2">FY start</div>
            <div className="col-span-2">Label</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Opened</div>
            <div className="col-span-3">Actions</div>
          </div>
          {periods.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No financial years recorded yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {periods.map((p) => (
                <li
                  key={p.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="col-span-2 font-mono tabular-nums">{p.financialYear}</div>
                  <div className="col-span-2 truncate">
                    {formatFinancialYearLabel(p.financialYear, fiscalYearStartMonth)}
                  </div>
                  <div className="col-span-2">
                    <span
                      className={
                        p.status === FinancialYearStatus.OPEN
                          ? "font-medium text-emerald-700 dark:text-emerald-400"
                          : "opacity-80"
                      }
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="col-span-3 text-xs opacity-80 tabular-nums">
                    {p.openedAt.toISOString().slice(0, 10)}
                    {p.closedAt ? ` → ${p.closedAt.toISOString().slice(0, 10)}` : ""}
                  </div>
                  <div className="col-span-3 flex justify-end">
                    {canManage && p.status === FinancialYearStatus.OPEN ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPendingClose({ id: p.id, financialYear: p.financialYear })
                        }
                        className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10"
                      >
                        Close year
                      </button>
                    ) : (
                      <span className="text-xs opacity-50">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {pendingClose && session ? (
        <ConfirmDialog
          title="Close this financial year?"
          description={`FY ${pendingClose.financialYear} will be closed. No new postings should use this year until it is reopened. Close only after month-end consolidation if that is your policy.`}
          confirmLabel="Close financial year"
          onCancel={() => setPendingClose(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("id", pendingClose.id);
            fd.set("userRole", session.role);
            await closeFinancialYearPeriodAction(fd);
            setPendingClose(null);
          }}
        />
      ) : null}
    </div>
  );
}
