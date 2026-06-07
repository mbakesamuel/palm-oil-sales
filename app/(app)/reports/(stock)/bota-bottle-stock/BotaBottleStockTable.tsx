import { fmtBotaBottleQty, type BotaBottleStockLedgerRow } from "./loader";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function BotaBottleStockTable(props: {
  rows: BotaBottleStockLedgerRow[];
  showProductColumn: boolean;
  truncated: boolean;
}) {
  const { rows, showProductColumn, truncated } = props;

  if (rows.length === 0) {
    return (
      <p className="text-sm opacity-70 py-8 text-center">
        No bottle stock movements recorded at Bota yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-foreground/4 text-left">
              <th className="px-3 py-2 font-medium">Date</th>
              {showProductColumn ? (
                <th className="px-3 py-2 font-medium">Product</th>
              ) : null}
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Movement</th>
              <th className="px-3 py-2 font-medium text-right">IN</th>
              <th className="px-3 py-2 font-medium text-right">OUT</th>
              <th className="px-3 py-2 font-medium text-right">Balance</th>
              <th className="px-3 py-2 font-medium">Document</th>
              <th className="px-3 py-2 font-medium">User</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-b-0 align-top">
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {formatDateTime(r.occurredAtIso)}
                </td>
                {showProductColumn ? (
                  <td className="px-3 py-2">{r.productName}</td>
                ) : null}
                <td className="px-3 py-2">{r.storageLocationName}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.kindLabel}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-300">
                  {r.inQty != null ? fmtBotaBottleQty(r.inQty, r.uom) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-red-700 dark:text-red-300">
                  {r.outQty != null ? fmtBotaBottleQty(r.outQty, r.uom) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {fmtBotaBottleQty(r.balanceQty, r.uom)}
                </td>
                <td className="px-3 py-2 opacity-80">{r.documentNo ?? "—"}</td>
                <td className="px-3 py-2">{r.userName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs opacity-70">
        {rows.length} movement{rows.length === 1 ? "" : "s"} shown (oldest first)
        {truncated ? ` · first ${rows.length} of more — narrow by product` : "."}
      </p>
    </div>
  );
}
