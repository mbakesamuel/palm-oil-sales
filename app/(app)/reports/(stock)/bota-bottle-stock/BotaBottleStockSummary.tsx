import type { ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, Scale } from "lucide-react";
import { fmtBotaBottleQty, type BotaBottleStockSummary } from "./loader";

export function BotaBottleStockSummaryCards(props: {
  summary: BotaBottleStockSummary;
}) {
  const { summary } = props;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard
        label="Total IN"
        value={fmtBotaBottleQty(summary.totalIn, summary.uom)}
        icon={<ArrowDownLeft className="size-4" aria-hidden />}
        tone="in"
      />
      <SummaryCard
        label="Total OUT"
        value={fmtBotaBottleQty(summary.totalOut, summary.uom)}
        icon={<ArrowUpRight className="size-4" aria-hidden />}
        tone="out"
      />
      <SummaryCard
        label="Current balance"
        value={fmtBotaBottleQty(summary.balance, summary.uom)}
        icon={<Scale className="size-4" aria-hidden />}
        tone="balance"
        hint="Live on-hand at Bota"
      />
    </div>
  );
}

function SummaryCard(props: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: "in" | "out" | "balance";
  hint?: string;
}) {
  const { label, value, icon, tone, hint } = props;
  const shell =
    tone === "in"
      ? "border-emerald-600/30 bg-emerald-600/8"
      : tone === "out"
        ? "border-red-600/25 bg-red-600/6"
        : "border-brand/30 bg-brand/10";

  const iconShell =
    tone === "in"
      ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
      : tone === "out"
        ? "bg-red-600/12 text-red-700 dark:text-red-300"
        : "bg-brand/15 text-brand";

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${shell}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 shrink-0 ${iconShell}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-[11px] opacity-65">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
