/** KPI tile classes using app theme tokens (brand / accent — agro-aware). */
export const DASHBOARD_TILE_COLORS = [
  "bg-brand text-brand-foreground",
  "bg-brand/85 text-brand-foreground",
  "bg-brand/70 text-brand-foreground",
  "bg-accent text-accent-foreground",
  "bg-brand/55 text-brand-foreground",
  "bg-accent/90 text-accent-foreground",
  "bg-brand/90 text-brand-foreground",
  "bg-brand/65 text-brand-foreground",
] as const;

export const DASHBOARD_CHART_CSS_VARS = [
  "--dashboard-chart-1",
  "--dashboard-chart-2",
  "--dashboard-chart-3",
  "--dashboard-chart-4",
  "--dashboard-chart-5",
  "--dashboard-chart-6",
] as const;

/** Fallbacks when CSS vars are unavailable (SSR / first paint). */
export const CHART_COLOR_FALLBACKS = [
  "#1b5e34",
  "#2d7a47",
  "#3d9a62",
  "#e8c547",
  "#5cb87a",
  "#142018",
] as const;
