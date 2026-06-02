"use client";

import * as React from "react";
import {
  CHART_COLOR_FALLBACKS,
  DASHBOARD_CHART_CSS_VARS,
} from "@/lib/dashboard/tile-colors";

function readChartColors(): string[] {
  if (typeof document === "undefined") {
    return [...CHART_COLOR_FALLBACKS];
  }
  const root = document.documentElement;
  const style = getComputedStyle(root);
  return DASHBOARD_CHART_CSS_VARS.map((varName, i) => {
    const value = style.getPropertyValue(varName).trim();
    return value || CHART_COLOR_FALLBACKS[i] || CHART_COLOR_FALLBACKS[0]!;
  });
}

export function useDashboardChartColors(): string[] {
  const [colors, setColors] = React.useState<string[]>(() => readChartColors());

  React.useEffect(() => {
    setColors(readChartColors());

    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setColors(readChartColors());
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-ui-theme", "class"],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
