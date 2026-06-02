import Link from "next/link";
import { DASHBOARD_TILE_COLORS } from "@/lib/dashboard/tile-colors";

export type MetricTile = {
  label: string;
  value: string;
  href?: string;
};

export function DashboardMetricGrid(props: { tiles: MetricTile[] }) {
  const { tiles } = props;
  if (tiles.length === 0) return null;

  const cols =
    tiles.length <= 3
      ? "grid-cols-3"
      : tiles.length <= 4
        ? "grid-cols-4"
        : tiles.length <= 6
          ? "grid-cols-3 sm:grid-cols-6"
          : "grid-cols-4 sm:grid-cols-4 lg:grid-cols-8";

  return (
    <div className={["grid gap-1 sm:gap-1.5", cols].join(" ")}>
      {tiles.map((tile, i) => {
        const color = DASHBOARD_TILE_COLORS[i % DASHBOARD_TILE_COLORS.length];
        const inner = (
          <>
            <div className="truncate text-[9px] font-medium uppercase tracking-wide opacity-90 sm:text-[10px]">
              {tile.label}
            </div>
            <div className="mt-0.5 truncate text-sm font-bold tabular-nums sm:text-base md:text-lg">
              {tile.value}
            </div>
          </>
        );
        const className = `min-w-0 rounded-md px-1.5 py-1 shadow-sm sm:px-2 sm:py-1.5 ${color}`;
        if (tile.href) {
          return (
            <Link key={tile.label} href={tile.href} className={className}>
              {inner}
            </Link>
          );
        }
        return (
          <div key={tile.label} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
