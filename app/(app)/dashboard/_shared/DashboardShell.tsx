import type { ReactNode } from "react";

export function DashboardShell(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { title, subtitle, children } = props;
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm opacity-80">{subtitle}</p> : null}
      </header>
      {children}
    </div>
  );
}
