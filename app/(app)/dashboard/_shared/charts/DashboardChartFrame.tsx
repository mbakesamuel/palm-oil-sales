"use client";

import * as React from "react";

export type DashboardChartSize = { width: number; height: number };

/** Recharts needs a positive pixel size; parent flex/grid must assign height. */
export function DashboardChartFrame(props: {
  children: (size: DashboardChartSize) => React.ReactNode;
}) {
  const [size, setSize] = React.useState<DashboardChartSize | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateSize = () => {
      const { width, height } = el.getBoundingClientRect();
      const w = Math.floor(width);
      const h = Math.floor(height);
      if (w <= 0 || h <= 0) {
        setSize(null);
        return;
      }
      setSize((prev) => (prev?.width === w && prev?.height === h ? prev : { width: w, height: h }));
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full min-h-[2.5rem] w-full min-w-0">
      {size ? props.children(size) : null}
    </div>
  );
}
