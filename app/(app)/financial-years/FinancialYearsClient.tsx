"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import { FinancialYearStatus, UserRole } from "@/lib/domain";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkingPeriod } from "@/contexts/WorkingPeriodContext";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  getSalesPointWorkingMonthAction,
  setSalesPointWorkingMonthAction,
} from "./working-month-actions";

function MonthGrid(props: {
  selectableMonths: Array<{ year: number; month: number; label: string }>;
  activeYear: number;
  activeMonth: number;
  onPick: (year: number, month: number) => void;
}) {
  const { selectableMonths, activeYear, activeMonth, onPick } = props;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {selectableMonths.map((row) => {
        const active = row.year === activeYear && row.month === activeMonth;
        return (
          <button
            key={`${row.year}-${row.month}`}
            type="button"
            onClick={() => onPick(row.year, row.month)}
            className={[
              "rounded-md border px-3 py-2 text-left text-sm transition-colors",
              active
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border hover:bg-accent/25",
            ].join(" ")}
          >
            <div className="font-medium tabular-nums">{row.label}</div>
          </button>
        );
      })}
    </div>
  );
}

export function FinancialYearsClient(props: {
  periods: Array<{
    id: string;
    financialYear: number;
    startDate: Date;
    endDate: Date;
    status: FinancialYearStatus;
    openedAt: Date;
    closedAt: Date | null;
  }>;
  salesPoints: Array<{ id: number; name: string }>;
  botaSalesPointId: number | null;
  canAdminSiteMonth: boolean;
  canSetBotaSiteMonth: boolean;
  openFinancialYearPeriodAction: (formData: FormData) => void;
  closeFinancialYearPeriodAction: (formData: FormData) => void;
}) {
  const {
    periods,
    salesPoints,
    botaSalesPointId,
    canAdminSiteMonth,
    canSetBotaSiteMonth,
    openFinancialYearPeriodAction,
    closeFinancialYearPeriodAction,
  } = props;

  const { status, session } = useAuth();
  const wp = useWorkingPeriod();

  const canManageFy =
    status === "ready" &&
    session != null &&
    (session.role === UserRole.ADMIN || session.role === UserRole.DIRECTOR);

  const showSiteMonthEditor =
    wp.workingMonthSource === "sales_point" && wp.canChangeWorkingMonth;
  const showPersonalMonthEditor = wp.workingMonthSource === "personal";
  const showSiteMonthReadOnly =
    wp.workingMonthSource === "sales_point" && !wp.canChangeWorkingMonth;
  const showAdminSiteMonth = canAdminSiteMonth && salesPoints.length > 0;
  const showBotaSiteMonth =
    canSetBotaSiteMonth &&
    botaSalesPointId != null &&
    wp.workingMonthSource === "personal";

  const [adminSalesPointId, setAdminSalesPointId] = React.useState<number | null>(
    () => salesPoints[0]?.id ?? null,
  );
  const [adminSiteYear, setAdminSiteYear] = React.useState(wp.workingCalendarYear);
  const [adminSiteMonth, setAdminSiteMonth] = React.useState(wp.workingCalendarMonth);
  const [botaSiteYear, setBotaSiteYear] = React.useState(wp.workingCalendarYear);
  const [botaSiteMonth, setBotaSiteMonth] = React.useState(wp.workingCalendarMonth);

  React.useEffect(() => {
    if (adminSalesPointId == null && salesPoints[0]) {
      setAdminSalesPointId(salesPoints[0].id);
    }
  }, [adminSalesPointId, salesPoints]);

  React.useEffect(() => {
    if (!showAdminSiteMonth || adminSalesPointId == null) return;
    void (async () => {
      const res = await getSalesPointWorkingMonthAction(adminSalesPointId);
      if ("error" in res) return;
      setAdminSiteYear(res.calendarYear);
      setAdminSiteMonth(res.calendarMonth);
    })();
  }, [showAdminSiteMonth, adminSalesPointId]);

  React.useEffect(() => {
    if (!showBotaSiteMonth || botaSalesPointId == null) return;
    void (async () => {
      const res = await getSalesPointWorkingMonthAction(botaSalesPointId);
      if ("error" in res) return;
      setBotaSiteYear(res.calendarYear);
      setBotaSiteMonth(res.calendarMonth);
    })();
  }, [showBotaSiteMonth, botaSalesPointId]);

  const setSiteMonth = React.useCallback(
    async (salesPointId: number, year: number, month: number) => {
      const fd = new FormData();
      fd.set("salesPointId", String(salesPointId));
      fd.set("calendarYear", String(year));
      fd.set("calendarMonth", String(month));
      await setSalesPointWorkingMonthAction(fd);
    },
    [],
  );

  const [yearToOpen, setYearToOpen] = React.useState(() => String(new Date().getFullYear()));
  const [startDate, setStartDate] = React.useState(() => {
    const y = new Date().getFullYear();
    return `${y}-01-01`;
  });
  const [endDate, setEndDate] = React.useState(() => {
    const y = new Date().getFullYear();
    return `${y}-12-31`;
  });

  React.useEffect(() => {
    const y = Number.parseInt(yearToOpen, 10);
    if (Number.isFinite(y)) {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  }, [yearToOpen]);

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
          Only one financial year can be <span className="font-medium">open</span> at a time. Each
          year has explicit <span className="font-medium">start and end dates</span>. Line supervisors
          set the <span className="font-medium">working calendar month</span> for their sales point;
          all clerks at that site use the same month. Roaming staff keep a personal working month.
          Transaction dates must stay within the active working month.
        </p>
      </div>

      {showSiteMonthReadOnly ? (
        <section className="space-y-3 rounded-lg border border-border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Working month at your sales point</h2>
          <p className="text-sm opacity-80">
            Your supervisor sets the working month for{" "}
            <span className="font-medium">{wp.salesPointName ?? "your site"}</span>. You cannot
            change it here.
          </p>
          <p className="text-sm">
            Current month:{" "}
            <span className="font-medium tabular-nums">{wp.workingMonthLabel}</span>
          </p>
          {wp.workingMonthStartIso && wp.workingMonthEndIso ? (
            <p className="text-xs opacity-70">
              Window:{" "}
              <span className="font-medium tabular-nums">
                {wp.workingMonthStartIso}–{wp.workingMonthEndIso}
              </span>
            </p>
          ) : null}
        </section>
      ) : null}

      {showSiteMonthEditor ? (
        <section className="space-y-3 rounded-lg border border-border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Working month for your sales point</h2>
          <p className="text-sm opacity-80">
            Applies to all clerks at{" "}
            <span className="font-medium">{wp.salesPointName ?? "your site"}</span>. Clerks will
            pick up changes within about 30 seconds.
          </p>
          {wp.openFinancialYear != null && wp.selectableMonths.length > 0 ? (
            <MonthGrid
              selectableMonths={wp.selectableMonths}
              activeYear={wp.workingCalendarYear}
              activeMonth={wp.workingCalendarMonth}
              onPick={(year, month) => wp.setWorkingCalendarMonth(year, month)}
            />
          ) : null}
        </section>
      ) : null}

      {showBotaSiteMonth ? (
        <section className="space-y-3 rounded-lg border border-border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Bota sales point working month</h2>
          <p className="text-sm opacity-80">
            Senior supervisors set the working month for Bota. Bota clerks use this month.
          </p>
          {wp.openFinancialYear != null && wp.selectableMonths.length > 0 ? (
            <MonthGrid
              selectableMonths={wp.selectableMonths}
              activeYear={botaSiteYear}
              activeMonth={botaSiteMonth}
              onPick={(year, month) => {
                setBotaSiteYear(year);
                setBotaSiteMonth(month);
                void setSiteMonth(botaSalesPointId!, year, month);
              }}
            />
          ) : null}
        </section>
      ) : null}

      {showAdminSiteMonth ? (
        <section className="space-y-3 rounded-lg border border-border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Set working month for a sales point</h2>
          <p className="text-sm opacity-80">
            Admin override: choose a sales point and set its site working month.
          </p>
          <label className="grid max-w-md gap-1 text-sm">
            <span className="font-medium">Sales point</span>
            <select
              className="rounded-md border border-border bg-transparent px-3 py-2"
              value={adminSalesPointId ?? ""}
              onChange={(e) =>
                setAdminSalesPointId(
                  e.target.value ? Number.parseInt(e.target.value, 10) : null,
                )
              }
            >
              {salesPoints.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </label>
          {wp.openFinancialYear != null && wp.selectableMonths.length > 0 ? (
            <MonthGrid
              selectableMonths={wp.selectableMonths}
              activeYear={adminSiteYear}
              activeMonth={adminSiteMonth}
              onPick={(year, month) => {
                if (adminSalesPointId == null) return;
                setAdminSiteYear(year);
                setAdminSiteMonth(month);
                void setSiteMonth(adminSalesPointId, year, month);
              }}
            />
          ) : null}
        </section>
      ) : null}

      {showPersonalMonthEditor ? (
        <section className="space-y-3 rounded-lg border border-border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Your personal working month</h2>
          <p className="text-sm opacity-80">
            Open year:{" "}
            {wp.openFinancialYear != null ? (
              <span className="font-medium tabular-nums">{wp.fyLabel}</span>
            ) : (
              <span className="font-medium text-amber-800 dark:text-amber-200/90">
                None — open a year below
              </span>
            )}
          </p>
          {wp.workingMonthStartIso && wp.workingMonthEndIso ? (
            <p className="text-xs opacity-70">
              Working month window:{" "}
              <span className="font-medium tabular-nums">
                {wp.workingMonthStartIso}–{wp.workingMonthEndIso}
              </span>
            </p>
          ) : null}
          {wp.openFinancialYear != null && wp.selectableMonths.length > 0 ? (
            <MonthGrid
              selectableMonths={wp.selectableMonths}
              activeYear={wp.workingCalendarYear}
              activeMonth={wp.workingCalendarMonth}
              onPick={(year, month) => wp.setWorkingCalendarMonth(year, month)}
            />
          ) : null}
        </section>
      ) : null}

      {canManageFy ? (
        <section className="space-y-4 rounded-lg border border-border p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Financial year calendar (admin / manager)</h2>
          <p className="text-sm opacity-75">
            Close the current year before opening another. For a <span className="font-medium">new</span>{" "}
            year label, set inclusive start and end dates. Re-opening a previously closed year keeps
            its stored dates.
          </p>

          <form
            action={openFinancialYearPeriodAction}
            className="flex flex-col gap-3 max-w-xl"
          >
            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="fy-open-year">
                Financial year label
              </label>
              <input
                id="fy-open-year"
                name="financialYear"
                type="number"
                min={1900}
                max={2100}
                value={yearToOpen}
                onChange={(e) => setYearToOpen(e.target.value)}
                className="rounded-md border border-border bg-transparent px-3 py-2"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-sm font-medium" htmlFor="fy-start">
                  Start date (new year only)
                </label>
                <input
                  id="fy-start"
                  name="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={openRow != null}
                  className="rounded-md border border-border bg-transparent px-3 py-2 disabled:opacity-50"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium" htmlFor="fy-end">
                  End date (new year only)
                </label>
                <input
                  id="fy-end"
                  name="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={openRow != null}
                  className="rounded-md border border-border bg-transparent px-3 py-2 disabled:opacity-50"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={openRow != null}
              className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50 w-fit"
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
        <section className="rounded-lg border border-border p-4 text-sm opacity-80">
          Only <span className="font-medium">admin</span> or <span className="font-medium">manager</span>{" "}
          can open or close financial years.
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">All periods</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-border">
            <div className="col-span-1">FY</div>
            <div className="col-span-2">From</div>
            <div className="col-span-2">To</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Opened</div>
            <div className="col-span-2">Actions</div>
          </div>
          {periods.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No financial years recorded yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {periods.map((p) => (
                <li
                  key={p.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="col-span-1 font-mono tabular-nums">{p.financialYear}</div>
                  <div className="col-span-2 text-xs tabular-nums">
                    {prismaDateToIso(p.startDate)}
                  </div>
                  <div className="col-span-2 text-xs tabular-nums">
                    {prismaDateToIso(p.endDate)}
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
                  <div className="col-span-2 flex justify-end">
                    {canManageFy && p.status === FinancialYearStatus.OPEN ? (
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
            await closeFinancialYearPeriodAction(fd);
            setPendingClose(null);
          }}
        />
      ) : null}
    </div>
  );
}
