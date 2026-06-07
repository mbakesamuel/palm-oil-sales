import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { OpenReportButton } from "@/components/OpenReportButton";
import { getServerSession } from "@/lib/auth-server";
import { getOrInitCompanySettings } from "@/lib/settings";
import {
  fmtDate,
  fmtKg,
  formatDailySalesDateRangeLabel,
  loadDailySalesSummary,
} from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function DailySalesSummaryPage(props: {
  searchParams: Promise<{ date?: string; from?: string; to?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const [data, settings] = await Promise.all([
    loadDailySalesSummary(session, searchParams),
    getOrInitCompanySettings(),
  ]);

  if (data.scopedToSalesPoint && data.assignedSalesPointId == null) {
    return (
      <div className="space-y-4 max-w-xl px-3 sm:px-8 lg:px-12">
        <h1 className="text-2xl font-semibold">Daily sales summary</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but no sales point is assigned to
          your account. Ask an administrator to assign one before you can view
          this report.
        </div>
      </div>
    );
  }

  const {
    monthFilter,
    monthFirstIso,
    monthLastIso,
    hasOpenFy,
    dateFromIso,
    dateToIso,
    dateInvalid,
    rangeInvalid,
    rows,
    totalsByType,
    grandQty,
    doMetaByNo,
    customerTypeOptions,
    scopedToSalesPoint,
    assignedSalesPointName,
  } = data;

  const rangeLabel = formatDailySalesDateRangeLabel(dateFromIso, dateToIso);
  const generated = new Date();

  return (
    <div className="space-y-6 w-full min-w-0 max-w-none px-1 py-2 sm:px-2 sm:py-4 lg:px-3 lg:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Daily sales summary</h1>

          <p className="text-sm opacity-75 mt-1">
            {scopedToSalesPoint && assignedSalesPointName
              ? `Sales at ${assignedSalesPointName} only. `
              : "All collection points (consolidated). "}
            {monthFilter ? (
              <>
                <span className="font-medium">Working month</span>:{" "}
                {monthFilter.label} (FY {monthFilter.financialYear}). Choose a
                from–to date range inside this month; rows are{" "}
                <span className="font-medium">validated</span> sales whose{" "}
                <span className="font-medium">sold-at</span> (UTC) falls in that
                range.
              </>
            ) : hasOpenFy ? (
              <>
                No working calendar month could be applied. Choose a date once a
                working month is available from the banner.
              </>
            ) : (
              <>
                No financial year is open. Open a year under Financial years to
                use this report.
              </>
            )}
          </p>
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {rangeLabel ? (
              <>
                {" "}
                · Period <span className="font-medium">{rangeLabel}</span> (
                {rows.length} validated sale{rows.length === 1 ? "" : "s"})
              </>
            ) : null}
          </p>
        </div>
        <div>
          <OpenReportButton
            href="/reports/daily-sales-summary/print"
            params={{ from: dateFromIso, to: dateToIso }}
            label="Print"
            disabled={!dateFromIso || !dateToIso || dateInvalid || rangeInvalid}
            title={
              !dateFromIso || !dateToIso ? "Pick a date range first" : undefined
            }
            sameTab
          />
        </div>
      </div>

      <form
        method="GET"
        className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end max-w-2xl"
      >
        <div className="grid gap-1 min-w-[10.5rem] flex-1">
          <label htmlFor="from" className="text-sm font-medium">
            From date
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={dateFromIso ?? ""}
            min={monthFirstIso ?? undefined}
            max={monthLastIso ?? undefined}
            disabled={!monthFilter}
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
        <div className="grid gap-1 min-w-[10.5rem] flex-1">
          <label htmlFor="to" className="text-sm font-medium">
            To date
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={dateToIso ?? ""}
            min={monthFirstIso ?? undefined}
            max={monthLastIso ?? undefined}
            disabled={!monthFilter}
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={!monthFilter}
          className="rounded-md border border-border bg-foreground/[0.08] px-4 py-2 text-sm font-medium hover:bg-accent/35 disabled:opacity-50"
        >
          Apply filter
        </button>
      </form>

      {monthFirstIso && monthLastIso ? (
        <p className="text-xs opacity-65 max-w-2xl">
          Allowed range: {monthFirstIso} to {monthLastIso} (working month). With
          no dates submitted, the report defaults to the full month through
          today.
        </p>
      ) : null}

      {dateInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          One or both dates are outside the current working calendar month.
          {monthFirstIso && monthLastIso
            ? ` Pick dates between ${monthFirstIso} and ${monthLastIso}.`
            : null}
        </div>
      ) : null}

      {rangeInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          The from date must be on or before the to date.
        </div>
      ) : null}

      <div className="w-full min-w-0 rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-208 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-2 py-1 font-medium">CUSTOMER</th>
              <th className="px-2 py-1 font-medium">DO NO.</th>
              <th className="px-2 py-1 font-medium">DATE</th>
              <th className="px-2 py-1 font-medium">V.C.N. No.</th>
              <th className="px-2 py-1 font-medium">DATE</th>
              <th className="px-2 py-1 font-medium text-right">KGS LIFTED</th>
              <th className="px-2 py-1 font-medium text-right">KG BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const doNo = s.deliveryOrderNo?.trim() ?? "";
              const meta = doNo ? doMetaByNo.get(doNo) : undefined;
              return (
                <tr
                  key={s.id}
                  className="border-b border-border odd:bg-foreground/4"
                >
                  <td
                    className="px-2 py-1 max-w-56 truncate"
                    title={s.customerNameSnapshot}
                  >
                    {s.customerNameSnapshot}
                  </td>
                  <td className="px-2 py-1 font-mono text-xs whitespace-nowrap">
                    {doNo || "—"}
                  </td>
                  <td className="px-2 py-1 tabular-nums whitespace-nowrap">
                    {meta ? fmtDate(meta.dateIssued) : "—"}
                  </td>
                  <td className="px-2 py-1 font-mono text-xs whitespace-nowrap">
                    {s.vehicleNumber || "—"}
                  </td>
                  <td className="px-2 py-1 tabular-nums whitespace-nowrap">
                    {fmtDate(s.dateIssued)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {fmtKg(s.qtyKg)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {meta ? fmtKg(meta.balanceKg) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && rangeLabel && !dateInvalid && !rangeInvalid ? (
        <p className="text-sm opacity-75">
          No validated sales for {rangeLabel} in this scope and working month.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">SUMMARY</h2>
          <div className="w-full max-w-md rounded-lg border border-border overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-foreground/[0.06]">
                  <th className="px-3 py-1 font-medium">Customer type</th>
                  <th className="px-3 py-1 font-medium text-right">Qty (kg)</th>
                </tr>
              </thead>
              <tbody>
                {customerTypeOptions.map((opt) => {
                  const q = totalsByType.get(opt.id);
                  if (!q || q.equals(z)) return null;
                  return (
                    <tr key={opt.id} className="border-b border-border">
                      <td className="px-3 py-1">{opt.name}</td>
                      <td className="px-3 py-1 text-right tabular-nums">
                        {fmtKg(q)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-medium border-t-2 border-border">
                  <td className="px-3 py-1">Grand total</td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    {fmtKg(grandQty)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
