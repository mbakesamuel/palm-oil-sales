import { Prisma } from "@prisma/client";
import { budgetAchievementPct } from "@/lib/sales-budget-for-period";
import {
  formatPhasedQtyKgDisplay,
  formatPhasedRevenueDisplay,
} from "@/lib/sales-budget-phase";
import { fmtKg, fmtXaf, type BudgetVsActualSlice } from "./loader";

function fmtPct(pct: number | null) {
  if (pct == null) return "—";
  return `${pct.toLocaleString("en-GB", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`;
}

function pctTone(pct: number | null) {
  if (pct == null) return "text-foreground/60";
  if (pct >= 100) return "text-emerald-700 dark:text-emerald-400";
  if (pct >= 75) return "text-foreground";
  return "text-amber-800 dark:text-amber-300";
}

function CompareBar(props: {
  label: string;
  budget: Prisma.Decimal;
  actual: Prisma.Decimal;
  formatValue: (d: Prisma.Decimal) => string;
  pct: number | null;
}) {
  const { label, budget, actual, formatValue, pct } = props;
  const max = Prisma.Decimal.max(budget, actual);
  const scale = max.gt(0) ? max : new Prisma.Decimal(1);
  const budgetPct = Number(budget.div(scale).mul(100).toFixed(1));
  const actualPct = Number(actual.div(scale).mul(100).toFixed(1));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium uppercase tracking-wide opacity-70">{label}</span>
        <span className={`tabular-nums font-semibold ${pctTone(pct)}`}>
          {fmtPct(pct)} of budget
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 opacity-70">Budget</span>
          <div className="h-5 flex-1 rounded-sm bg-foreground/[0.06] overflow-hidden">
            <div
              className="h-full rounded-sm bg-foreground/25"
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right tabular-nums">{formatValue(budget)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-14 shrink-0 opacity-70">Actual</span>
          <div className="h-5 flex-1 rounded-sm bg-foreground/[0.06] overflow-hidden">
            <div
              className="h-full rounded-sm bg-emerald-600/70 dark:bg-emerald-500/60"
              style={{ width: `${actualPct}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right tabular-nums font-medium">
            {formatValue(actual)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProductBudgetVsActual(props: {
  budgetVsActual: BudgetVsActualSlice;
  compact?: boolean;
}) {
  const { budgetVsActual, compact = false } = props;
  const { budgetQtyKg, budgetRevenue, actualQtyKg, actualRevenue } = budgetVsActual;

  const qtyPct = budgetAchievementPct(actualQtyKg, budgetQtyKg);
  const revPct = budgetAchievementPct(actualRevenue, budgetRevenue);

  const pad = compact ? "px-2 py-2" : "px-3 py-3";

  return (
    <div
      className={`rounded-b-md border border-t-0 border-border bg-foreground/[0.02] ${pad} print:break-inside-avoid`}
    >
      <p className="text-xs font-semibold mb-3">Budget vs actual (period)</p>
      <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
        <CompareBar
          label="Quantity"
          budget={budgetQtyKg}
          actual={actualQtyKg}
          formatValue={(d) => formatPhasedQtyKgDisplay(d) || fmtKg(d) || "0"}
          pct={qtyPct}
        />
        <CompareBar
          label="Revenue"
          budget={budgetRevenue}
          actual={actualRevenue}
          formatValue={(d) => formatPhasedRevenueDisplay(d) || fmtXaf(d) || "0"}
          pct={revPct}
        />
      </div>
      <table className="mt-3 w-full max-w-3xl text-xs border-collapse">
        <thead>
          <tr className="border-b border-border text-left opacity-70">
            <th className="py-1 pr-2 font-medium" />
            <th className="py-1 pr-2 font-medium text-right">Budget</th>
            <th className="py-1 pr-2 font-medium text-right">Actual</th>
            <th className="py-1 font-medium text-right">Achievement</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/60">
            <td className="py-1.5 pr-2 font-medium">Qty (kg)</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">
              {formatPhasedQtyKgDisplay(budgetQtyKg)}
            </td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{fmtKg(actualQtyKg)}</td>
            <td className={`py-1.5 text-right tabular-nums font-medium ${pctTone(qtyPct)}`}>
              {fmtPct(qtyPct)}
            </td>
          </tr>
          <tr>
            <td className="py-1.5 pr-2 font-medium">Revenue (XAF)</td>
            <td className="py-1.5 pr-2 text-right tabular-nums">
              {formatPhasedRevenueDisplay(budgetRevenue)}
            </td>
            <td className="py-1.5 pr-2 text-right tabular-nums">{fmtXaf(actualRevenue)}</td>
            <td className={`py-1.5 text-right tabular-nums font-medium ${pctTone(revPct)}`}>
              {fmtPct(revPct)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
