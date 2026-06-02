import type { ReactNode } from "react";

/** Equal-height grid for operations / reports tabs; children should use min-h-0 overflow-hidden. */
export function DashboardFitGrid(props: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "grid h-full min-h-0 flex-1 auto-rows-fr gap-1.5 overflow-hidden sm:grid-cols-2 sm:gap-2",
        props.className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {props.children}
    </div>
  );
}
