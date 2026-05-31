import { redirect } from "next/navigation";
import { OpenReportButton } from "@/components/OpenReportButton";
import { getServerSession } from "@/lib/auth-server";
import { StockVsCommitmentsDetailTables } from "./StockVsCommitmentsDetailTables";
import { StockVsCommitmentsSummaryCards } from "./StockVsCommitmentsSummaryCards";
import {
  loadStockVsCommitmentsReport,
  STOCK_VS_COMMITMENTS_CONDITION_LABELS,
} from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function StockVsCommitmentsReportPage(props: {
  searchParams: Promise<{
    productId?: string;
    salesPointId?: string;
    condition?: string;
  }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const data = await loadStockVsCommitmentsReport(session, searchParams);

  if ("type" in data) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Stock vs commitments</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
      </div>
    );
  }

  const generated = new Date();
  const hasInvalidFilter = data.productInvalid || data.salesPointInvalid;
  const showSalesPointColumn =
    !data.scopedToSalesPoint && !data.selectedSalesPointId;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stock vs commitments</h1>
          <p className="text-sm opacity-75 mt-1">
            {data.scopedToSalesPoint && data.assignedSalesPointName
              ? `Compare on-hand stock to outstanding delivery-order commitments at ${data.assignedSalesPointName}. `
              : "Compare on-hand stock to outstanding delivery-order commitments. "}
            Stock is summarized across storage locations; commitments are
            summarized across customers (validated DO qty minus validated
            invoiced qty). Filter by product, sales point, or stock condition.
          </p>
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {" · "}
            Live stock · {data.commitmentOrderCount} DO
            {data.commitmentOrderCount === 1 ? "" : "s"} with outstanding
            commitment
          </p>
        </div>
        <div>
          <OpenReportButton
            href="/reports/stock-vs-commitments/print"
            params={{
              productId: data.selectedProductId || undefined,
              salesPointId: data.selectedSalesPointId || undefined,
              condition:
                data.selectedCondition !== "all"
                  ? data.selectedCondition
                  : undefined,
            }}
            label="Print report"
            disabled={hasInvalidFilter}
            sameTab
          />
        </div>
      </div>

      <form method="GET" className="space-y-2">
        <div className="flex flex-wrap items-end gap-3">
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
              <option value="">All kg products</option>
              {data.productOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {!data.scopedToSalesPoint ? (
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
          ) : null}
          <div className="grid gap-1 min-w-[11rem] flex-1">
            <label htmlFor="condition" className="text-sm font-medium">
              Stock condition
            </label>
            <select
              id="condition"
              name="condition"
              defaultValue={data.selectedCondition}
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
            >
              {Object.entries(STOCK_VS_COMMITMENTS_CONDITION_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
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
          Commitments always reflect live validated DO balances; the condition
          filter applies to stock only.
        </p>
      </form>

      {data.productInvalid || data.salesPointInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          One or more filters are invalid for your scope. Clear filters and try
          again.
        </div>
      ) : null}

      {!hasInvalidFilter ? (
        <>
          <StockVsCommitmentsSummaryCards
            scopeLabel={data.scopeLabel}
            overallStockKg={data.overallStockKg}
            overallCommitmentKg={data.overallCommitmentKg}
            uncommittedKg={data.uncommittedKg}
          />

          <StockVsCommitmentsDetailTables
            scopedToSalesPoint={data.scopedToSalesPoint}
            showSalesPointColumn={showSalesPointColumn}
            stockByLocation={data.stockByLocation}
            commitmentByCustomer={data.commitmentByCustomer}
          />
        </>
      ) : null}
    </div>
  );
}
