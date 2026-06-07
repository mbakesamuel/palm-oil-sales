import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { BotaBottleStockSummaryCards } from "./BotaBottleStockSummary";
import { BotaBottleStockTable } from "./BotaBottleStockTable";
import { loadBotaBottleStockReport } from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BotaBottleStockReportPage(props: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const data = await loadBotaBottleStockReport(session, searchParams);

  if ("type" in data) {
    const messages: Record<string, string> = {
      "not-configured":
        "Bota sales point is not configured. Run seed or set BOTA_SALES_POINT_ID.",
      "bota-only":
        "This ledger is restricted to staff assigned to the Bota sales point.",
      "no-sales-point":
        "Your role requires a sales point assignment. Ask an administrator to assign you to Bota.",
    };
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Bota bottle stock ledger</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          {messages[data.type]}
        </div>
      </div>
    );
  }

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bota bottle stock ledger</h1>
        <p className="text-sm opacity-75 mt-1">
          Bottled palm oil only · {data.botaSalesPointName} sales point · IN / OUT
          movement history with running balance.
        </p>
        <p className="text-xs opacity-70 mt-1 tabular-nums">
          Generated{" "}
          {generated.toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          {" · "}
          {data.summary.movementCount} movement
          {data.summary.movementCount === 1 ? "" : "s"}
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1 min-w-[14rem] flex-1 max-w-md">
          <label htmlFor="productId" className="text-sm font-medium">
            Product
          </label>
          <select
            id="productId"
            name="productId"
            defaultValue={data.selectedProductId}
            className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
          >
            <option value="">All bottled products</option>
            {data.productOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="h-10 shrink-0 rounded-md border border-border bg-foreground/8 px-4 text-sm font-medium hover:bg-accent/35"
        >
          Apply filter
        </button>
      </form>

      {data.productInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          The selected product is invalid. Choose another bottled product.
        </div>
      ) : null}

      {!data.productInvalid ? (
        <>
          <BotaBottleStockSummaryCards summary={data.summary} />
          <BotaBottleStockTable
            rows={data.rows}
            showProductColumn={data.showProductColumn}
            truncated={data.truncated}
          />
        </>
      ) : null}
    </div>
  );
}
