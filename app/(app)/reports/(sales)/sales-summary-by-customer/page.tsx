import Link from "next/link";
import { redirect } from "next/navigation";
import { OpenReportButton } from "@/components/OpenReportButton";
import { getServerSession } from "@/lib/auth-server";
import {
  GrandCustomerSummaryTable,
  ProductCustomerSummaryTable,
} from "./ProductCustomerSummaryTable";
import {
  loadSalesSummaryByCustomer,
  SALES_SUMMARY_INTERVALS,
  SALES_SUMMARY_INTERVAL_LABELS,
  type SalesSummaryInterval,
} from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function tabHref(
  interval: SalesSummaryInterval,
  opts?: { date?: string | null; week?: string | null },
) {
  const params = new URLSearchParams({ interval });
  if (interval === "daily" && opts?.date) params.set("date", opts.date);
  if (interval === "weekly" && opts?.week) params.set("week", opts.week);
  return `/reports/sales-summary-by-customer?${params.toString()}`;
}

export default async function SalesSummaryByCustomerPage(props: {
  searchParams: Promise<{ interval?: string; date?: string; week?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const data = await loadSalesSummaryByCustomer(session, searchParams);

  if (data.scopedToSalesPoint && data.assignedSalesPointId == null) {
    return (
      <div className="space-y-4 max-w-xl px-3 sm:px-8 lg:px-12">
        <h1 className="text-2xl font-semibold">Sales summary by customer</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but no sales point is assigned to
          your account. Ask an administrator to assign one before you can view
          this report.
        </div>
      </div>
    );
  }

  const generated = new Date();
  const dailyDate =
    data.interval === "daily" ? (searchParams.date ?? data.dateFromIso ?? "") : "";
  const weeklyWeek =
    data.interval === "weekly"
      ? (searchParams.week ?? data.selectedIsoWeek ?? "")
      : "";

  return (
    <div className="space-y-6 w-full min-w-0 max-w-none px-1 py-2 sm:px-2 sm:py-4 lg:px-3 lg:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sales summary by customer</h1>
          <p className="text-sm opacity-75 mt-1">
            {data.scopedToSalesPoint && data.assignedSalesPointName
              ? `Sales at ${data.assignedSalesPointName} only. `
              : "All collection points (consolidated). "}
            Validated palm-oil sales only — quantity (kg) and net revenue (XAF)
            by customer type and product.
          </p>
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {data.periodLabel ? (
              <>
                {" "}
                · Period{" "}
                <span className="font-medium">{data.periodLabel}</span>
              </>
            ) : null}
          </p>
        </div>
        <div>
          <OpenReportButton
            href="/reports/sales-summary-by-customer/print"
            params={{
              interval: data.interval,
              ...(data.interval === "daily" && dailyDate ? { date: dailyDate } : {}),
              ...(data.interval === "weekly" && weeklyWeek ? { week: weeklyWeek } : {}),
            }}
            label="Print"
            disabled={!data.dateFromIso || data.dateInvalid}
            sameTab
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {SALES_SUMMARY_INTERVALS.map((iv) => (
          <Link
            key={iv}
            href={tabHref(iv, {
              date: iv === "daily" ? dailyDate : undefined,
              week: iv === "weekly" ? weeklyWeek : undefined,
            })}
            className={[
              "rounded-md border px-3 py-1.5 font-medium",
              data.interval === iv
                ? "border-foreground/25 bg-accent/35"
                : "border-border hover:bg-accent/25",
            ].join(" ")}
          >
            {SALES_SUMMARY_INTERVAL_LABELS[iv]} tab
          </Link>
        ))}
      </div>

      {data.interval === "daily" && data.monthFilter ? (
        <form
          method="GET"
          className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end max-w-md"
        >
          <input type="hidden" name="interval" value="daily" />
          <div className="grid gap-1 min-w-[10.5rem] flex-1">
            <label htmlFor="date" className="text-sm font-medium">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={dailyDate}
              min={data.monthFirstIso ?? undefined}
              max={data.monthLastIso ?? undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-border bg-foreground/[0.08] px-4 py-2 text-sm font-medium hover:bg-accent/35"
          >
            Apply
          </button>
        </form>
      ) : null}

      {data.interval === "weekly" && data.monthFilter && data.isoWeekOptions.length > 0 ? (
        <form method="GET" className="flex flex-col gap-2 max-w-xl">
          <input type="hidden" name="interval" value="weekly" />
          <div className="flex flex-row flex-wrap gap-3 items-end">
            <div className="grid gap-1 min-w-[14rem] flex-1">
              <label htmlFor="week" className="text-sm font-medium">
                Week
              </label>
              <select
                id="week"
                name="week"
                defaultValue={weeklyWeek}
                className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              >
                {data.isoWeekOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md border border-border bg-foreground/[0.08] px-4 py-2 text-sm font-medium hover:bg-accent/35 shrink-0"
            >
              Apply
            </button>
          </div>
          <p className="text-xs opacity-70">
            Weeks in {data.monthFilter.label} (FY {data.monthFilter.financialYear}
            ).
          </p>
        </form>
      ) : null}

      {!data.hasOpenFy && data.interval === "yearly" ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          No financial year is open. Open a year under Financial years to use the
          yearly tab.
        </div>
      ) : null}

      {!data.monthFilter &&
      data.interval !== "yearly" &&
      data.hasOpenFy ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          No working calendar month could be applied. Choose a working month
          from the banner before using this report.
        </div>
      ) : null}

      {data.dateInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          {data.interval === "daily" ? (
            <>
              The selected date is outside the current working calendar month.
              {data.monthFirstIso && data.monthLastIso
                ? ` Pick a date between ${data.monthFirstIso} and ${data.monthLastIso}.`
                : null}
            </>
          ) : data.interval === "weekly" ? (
            <>
              The selected week is not part of the current working calendar
              month.
              {data.monthFirstIso && data.monthLastIso
                ? ` Choose a week that falls within ${data.monthFirstIso} and ${data.monthLastIso}.`
                : null}
            </>
          ) : (
            <>The selected period is invalid.</>
          )}
        </div>
      ) : null}

      {data.products.length === 0 &&
      data.dateFromIso &&
      !data.dateInvalid ? (
        <p className="text-sm opacity-75">
          No validated sales for {data.periodLabel} in this scope.
        </p>
      ) : null}

      <div className="space-y-6">
        {data.products.map((block) => (
          <ProductCustomerSummaryTable
            key={block.productId}
            block={block}
            customerTypeOptions={data.customerTypeOptions}
          />
        ))}
      </div>

      {data.products.length > 1 ? (
        <GrandCustomerSummaryTable
          grandByType={data.grandByType}
          grandTotal={data.grandTotal}
          customerTypeOptions={data.customerTypeOptions}
          grandBudgetVsActual={data.grandBudgetVsActual}
        />
      ) : null}
    </div>
  );
}
