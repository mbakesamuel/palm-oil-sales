import type { ReactNode } from "react";
import Link from "next/link";

export function DashboardPageLayout(props: {
  title: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const { title, subtitle, actionHref, actionLabel, sidebar, children } = props;

  return (
    <div className="dashboard-crm flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-sidebar/80">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-background px-2 py-1.5 shadow-sm sm:px-4 sm:py-2">
        <div className="min-w-0 space-y-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg md:text-xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="truncate text-[10px] text-foreground/70 sm:text-xs">{subtitle}</p>
          ) : null}
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="shrink-0 rounded-md border border-brand/30 bg-background px-2 py-1 text-[10px] font-medium text-brand hover:bg-brand/5 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            {actionLabel}
          </Link>
        ) : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,5.25rem)] gap-1.5 overflow-hidden p-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,6.25rem)] sm:gap-2 sm:p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,7.25rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,9.5rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,10.5rem)]">
        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">{children}</main>
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border/60 pl-1.5 sm:pl-2">
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden sm:gap-1.5">
            {sidebar}
          </div>
        </aside>
      </div>

      <footer className="hidden shrink-0 bg-brand px-2 py-1 text-center text-[10px] text-brand-foreground sm:block sm:px-4 sm:py-1.5 sm:text-xs">
        Need help? Visit{" "}
        <Link
          href="/reports"
          className="font-medium underline underline-offset-2 hover:opacity-90"
        >
          Reports
        </Link>{" "}
        or{" "}
        <Link
          href="/financial-years"
          className="font-medium underline underline-offset-2 hover:opacity-90"
        >
          Financial years
        </Link>{" "}
        to change the working month.
      </footer>
    </div>
  );
}
