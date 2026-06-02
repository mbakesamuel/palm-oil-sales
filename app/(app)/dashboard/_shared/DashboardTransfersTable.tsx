import Link from "next/link";
import type { IncomingTransferRow } from "@/lib/dashboard/types";
import { DashboardChartCard } from "./DashboardChartCard";

const MAX_ROWS = 4;

export function DashboardTransfersTable(props: {
  transfers: IncomingTransferRow[];
  scopedSalesPointId: number | null;
  scopeLabel: string;
}) {
  const { transfers, scopedSalesPointId, scopeLabel } = props;
  const hasIncoming = transfers.length > 0;
  const visible = transfers.slice(0, MAX_ROWS);

  return (
    <DashboardChartCard
      title="Incoming stock transfers"
      subtitle={scopeLabel}
      className="min-h-0 flex-1"
    >
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Link
          href="/stock?tab=transfers"
          className="text-[9px] underline underline-offset-4 opacity-80 hover:opacity-100 sm:text-[10px]"
        >
          View all
        </Link>
      </div>
      {transfers.length === 0 ? (
        <div className="text-[10px] opacity-70 sm:text-xs">No transfers awaiting receipt.</div>
      ) : (
        <div
          className={[
            "min-h-0 flex-1 overflow-hidden rounded-md",
            hasIncoming ? "border border-amber-600/25 bg-amber-500/5" : "",
          ].join(" ")}
        >
          <table className="w-full table-fixed text-[9px] sm:text-[10px]">
            <thead>
              <tr className="border-b border-border bg-accent/15 text-left">
                <th className="truncate p-1 font-medium">Transfer</th>
                <th className="truncate p-1 font-medium">From</th>
                {scopedSalesPointId == null ? (
                  <th className="truncate p-1 font-medium">To</th>
                ) : null}
                <th className="truncate p-1 font-medium">Disp.</th>
                <th className="p-1 text-right font-medium">Ln</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-b-0">
                  <td className="truncate p-1 font-medium">{t.transferNo}</td>
                  <td className="truncate p-1 opacity-80">{t.fromName}</td>
                  {scopedSalesPointId == null ? (
                    <td className="truncate p-1 opacity-80">{t.toName}</td>
                  ) : null}
                  <td className="truncate p-1 opacity-80">{t.dispatchedIso}</td>
                  <td className="p-1 text-right tabular-nums opacity-80">{t.lineCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transfers.length > MAX_ROWS ? (
            <p className="truncate p-1 text-[9px] opacity-60">
              +{transfers.length - MAX_ROWS} more — open stock transfers
            </p>
          ) : null}
        </div>
      )}
    </DashboardChartCard>
  );
}
