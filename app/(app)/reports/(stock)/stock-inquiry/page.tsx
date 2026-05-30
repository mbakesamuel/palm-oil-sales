import { redirect } from "next/navigation";
import { OpenReportButton } from "@/components/OpenReportButton";
import { getServerSession } from "@/lib/auth-server";
import { utcIsoDateToday } from "@/lib/posting-calendar";
import { StockInquirySummaryCards } from "./StockInquirySummaryCards";
import { StockInquiryTable } from "./StockInquiryTable";
import {
  formatAsAtLabel,
  loadStockInquiryReport,
  STOCK_INQUIRY_CONDITION_LABELS,
  STOCK_INQUIRY_CONDITIONS,
} from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StockInquiryReportPage(props: {
  searchParams: Promise<{
    productId?: string;
    locationId?: string;
    salesPointId?: string;
    condition?: string;
    asAt?: string;
  }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const data = await loadStockInquiryReport(session, searchParams);

  if ("type" in data) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Stock inquiry</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
      </div>
    );
  }

  const generated = new Date();
  const hasInvalidFilter =
    data.productInvalid ||
    data.locationInvalid ||
    data.salesPointInvalid ||
    data.asAtInvalid;
  const todayIso = utcIsoDateToday();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock inquiry</h1>
          <p className="text-sm opacity-75 mt-1">
            {data.scopedToSalesPoint && data.assignedSalesPointName
              ? `Stock at ${data.assignedSalesPointName} only. `
              : "All sales points (consolidated). "}
            Filter by product,{" "}
            {data.scopedToSalesPoint
              ? "storage location"
              : "sales point"}
            , sellable / unsellable condition, and optional as-at date. Leave
            the date blank for live stock; a past date rebuilds on-hand from
            the movement ledger using each document&apos;s business date (e.g.
            receipt received date), not today&apos;s balance.
          </p>
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {data.selectedAsAt && !data.asAtInvalid ? (
              <>
                {" · "}
                Stock as at{" "}
                <span className="font-medium">
                  {formatAsAtLabel(data.selectedAsAt)}
                </span>
                {data.isLiveStock ? " (live)" : null}
              </>
            ) : (
              <> · Live stock</>
            )}
            {" · "}
            {data.rowCount} row{data.rowCount === 1 ? "" : "s"}
          </p>
        </div>
        <div>
          <OpenReportButton
            href="/reports/stock-inquiry/print"
            params={{
              productId: data.selectedProductId || undefined,
              ...(data.scopedToSalesPoint
                ? { locationId: data.selectedLocationId || undefined }
                : { salesPointId: data.selectedSalesPointId || undefined }),
              condition:
                data.selectedCondition !== "all"
                  ? data.selectedCondition
                  : undefined,
              asAt: data.selectedAsAt || undefined,
            }}
            label="Print report"
            disabled={hasInvalidFilter}
            sameTab
          />
        </div>
      </div>

      <form method="GET" className="space-y-2">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1 min-w-[10.5rem] flex-1">
            <label htmlFor="asAt" className="text-sm font-medium">
              As at date
            </label>
            <input
              id="asAt"
              name="asAt"
              type="date"
              defaultValue={data.selectedAsAt}
              max={todayIso}
              title="Leave blank for live stock today"
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
            />
          </div>
          <div className="grid gap-1 min-w-[11rem] flex-[1.2]">
            <label htmlFor="productId" className="text-sm font-medium">
              Product
            </label>
            <select
              id="productId"
              name="productId"
              defaultValue={data.selectedProductId}
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
            >
              <option value="">All products</option>
              {data.productOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {data.scopedToSalesPoint ? (
            <div className="grid gap-1 min-w-[12rem] flex-[1.2]">
              <label htmlFor="locationId" className="text-sm font-medium">
                Storage location
              </label>
              <select
                id="locationId"
                name="locationId"
                defaultValue={data.selectedLocationId}
                className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
              >
                <option value="">All locations</option>
                {data.locationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-1 min-w-[12rem] flex-[1.2]">
              <label htmlFor="salesPointId" className="text-sm font-medium">
                Sales point
              </label>
              <select
                id="salesPointId"
                name="salesPointId"
                defaultValue={data.selectedSalesPointId}
                className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
              >
                <option value="">All sales points</option>
                {data.salesPointOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-1 min-w-[11rem] flex-1">
            <label htmlFor="condition" className="text-sm font-medium">
              Condition
            </label>
            <select
              id="condition"
              name="condition"
              defaultValue={data.selectedCondition}
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
            >
              {STOCK_INQUIRY_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {STOCK_INQUIRY_CONDITION_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-md border border-border bg-foreground/8 px-4 text-sm font-medium hover:bg-accent/35"
          >
            Apply filters
          </button>
        </div>
        <p className="text-xs opacity-60">
          As at date blank = live stock today.
        </p>
      </form>

      {data.asAtInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          {data.asAtFuture
            ? "The as-at date cannot be in the future. Choose today or an earlier date."
            : "The as-at date is invalid. Use a calendar date (YYYY-MM-DD)."}
        </div>
      ) : null}

      {data.productInvalid || data.locationInvalid || data.salesPointInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          One or more filters are invalid for your scope. Clear filters and try
          again.
        </div>
      ) : null}

      {!hasInvalidFilter ? (
        <StockInquirySummaryCards
          productSummaries={data.productSummaries}
          conditionSummaries={data.conditionSummaries}
        />
      ) : null}

      <StockInquiryTable
        scopedToSalesPoint={data.scopedToSalesPoint}
        sections={data.sections}
      />
    </div>
  );
}
