import { redirect } from "next/navigation";
import { OpenReportButton } from "@/components/OpenReportButton";
import { getServerSession } from "@/lib/auth-server";
import { DailySalesCrosstabTable } from "./DailySalesCrosstabTable";
import { loadDailySalesCrosstab } from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DailySalesCrosstabPage(props: {
  searchParams: Promise<{ salesPointId?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const data = await loadDailySalesCrosstab(session, searchParams);

  if ("type" in data) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Daily sales report</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
      </div>
    );
  }

  const generated = new Date();
  const hasInvalidFilter = data.salesPointInvalid;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Daily sales report</h1>
          <p className="text-sm opacity-75 mt-1">
            {data.scopedToSalesPoint && data.assignedSalesPointName
              ? `Sales at ${data.assignedSalesPointName} only. `
              : "Choose a sales point to view its daily breakdown. "}
            {data.monthFilter ? (
              <>
                Working month{" "}
                <span className="font-medium">{data.monthFilter.label}</span> (FY{" "}
                {data.monthFilter.financialYear}) — validated sales quantities
                (kg) by day and customer category.
              </>
            ) : data.hasOpenFy ? (
              "No working calendar month is set."
            ) : (
              "Open a financial year to use this report."
            )}
          </p>
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {data.selectedSalesPointName ? (
              <>
                {" · "}
                <span className="font-medium">{data.selectedSalesPointName}</span>
              </>
            ) : null}
          </p>
        </div>
        <div>
          <OpenReportButton
            href="/reports/daily-sales-crosstab/print"
            params={{
              salesPointId: data.selectedSalesPointId || undefined,
            }}
            label="Print report"
            disabled={hasInvalidFilter || !data.selectedSalesPointId}
            sameTab
          />
        </div>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3 max-w-xl">
        {data.scopedToSalesPoint ? (
          <div className="grid gap-1 min-w-[12rem] flex-1">
            <span className="text-sm font-medium">Sales point</span>
            <p className="h-10 flex items-center rounded-md border border-border bg-foreground/[0.04] px-3 text-sm">
              {data.assignedSalesPointName ?? "—"}
            </p>
          </div>
        ) : (
          <div className="grid gap-1 min-w-[12rem] flex-1">
            <label htmlFor="salesPointId" className="text-sm font-medium">
              Sales point
            </label>
            <select
              id="salesPointId"
              name="salesPointId"
              defaultValue={data.selectedSalesPointId}
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
            >
              {data.salesPointOptions.length === 0 ? (
                <option value="">No sales points</option>
              ) : (
                data.salesPointOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
        <button
          type="submit"
          className="h-10 shrink-0 rounded-md border border-border bg-foreground/8 px-4 text-sm font-medium hover:bg-accent/35"
        >
          Apply filter
        </button>
      </form>

      {data.salesPointInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          The selected sales point is invalid. Choose another and try again.
        </div>
      ) : null}

      {!hasInvalidFilter && data.selectedSalesPointId ? (
        <DailySalesCrosstabTable
          columns={data.columns}
          rows={data.rows}
          colTotals={data.colTotals}
          grandTotal={data.grandTotal}
        />
      ) : null}

      {!hasInvalidFilter &&
      data.selectedSalesPointId &&
      data.grandTotal.equals(0) &&
      data.monthFilter ? (
        <p className="text-sm opacity-75">
          No validated sales for {data.selectedSalesPointName} in{" "}
          {data.monthFilter.label}.
        </p>
      ) : null}

      <p className="text-xs opacity-60 max-w-2xl">
        Categories: Industry, Whole sale, and Retail follow customer type.
        Estates = Worker customers (including ration sales). Staff = credit
        payment sales. Trnsfr = outbound transfer sales (BPO-OUTBOUND). Public
        Rel = complimentary GM issues (zero price).
      </p>
    </div>
  );
}
