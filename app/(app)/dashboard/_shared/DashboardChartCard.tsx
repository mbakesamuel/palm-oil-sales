import type { ReactNode } from "react";

export function DashboardChartCard(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border bg-background p-1.5 shadow-sm sm:p-2",
        props.className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="shrink-0">
        <h3 className="truncate text-[10px] font-semibold sm:text-xs">{props.title}</h3>
        {props.subtitle ? (
          <p className="truncate text-[9px] text-foreground/65 sm:text-[10px]">{props.subtitle}</p>
        ) : null}
      </div>
      <div className="mt-1 min-h-0 flex-1">{props.children}</div>
    </div>
  );
}
