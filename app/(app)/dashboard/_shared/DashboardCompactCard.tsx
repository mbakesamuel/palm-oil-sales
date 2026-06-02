import type { ReactNode } from "react";

export function DashboardCompactCard(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <article className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-background p-2 shadow-sm sm:p-3">
      <div className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-xs font-semibold sm:text-sm">{props.title}</h2>
          {props.subtitle ? (
            <p className="truncate text-[10px] opacity-70 sm:text-xs">{props.subtitle}</p>
          ) : null}
        </div>
        {props.action}
      </div>
      <div className="mt-1.5 min-h-0 flex-1 overflow-hidden">{props.children}</div>
    </article>
  );
}
