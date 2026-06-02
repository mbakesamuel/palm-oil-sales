"use client";

import * as React from "react";

/** Recharts needs a positive pixel size; parent flex/grid must assign height. */
export function DashboardChartFrame(props: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const markReady = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setReady(true);
    };

    markReady();
    const ro = new ResizeObserver(markReady);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full min-h-[2.5rem] w-full min-w-0">
      {ready ? props.children : null}
    </div>
  );
}
