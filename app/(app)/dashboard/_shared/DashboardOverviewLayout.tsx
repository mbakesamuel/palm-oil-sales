import type { ReactNode } from "react";

/** Metrics row + chart grid that shares remaining viewport height without scrolling. */
export function DashboardOverviewLayout(props: {
  metrics: ReactNode;
  charts: ReactNode;
  /** Number of chart cards (2 or 4) — controls row/column split. */
  chartCount?: 2 | 4;
}) {
  const dual = props.chartCount === 2;
  const chartGrid = dual
    ? "grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1"
    : "grid-cols-1 grid-rows-4 sm:grid-cols-2 sm:grid-rows-2";

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden sm:gap-2">
      <div className="shrink-0">{props.metrics}</div>
      <div
        className={[
          "grid min-h-0 flex-1 gap-1.5 overflow-hidden sm:gap-2",
          chartGrid,
        ].join(" ")}
      >
        {props.charts}
      </div>
    </div>
  );
}
