"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type DashboardTab = {
  id: string;
  label: string;
};

export function DashboardTabs(props: {
  tabs: DashboardTab[];
  defaultTab?: string;
  children: React.ReactNode;
}) {
  const { tabs, defaultTab = tabs[0]?.id, children } = props;
  const searchParams = useSearchParams();
  const router = useRouter();
  const active =
    searchParams.get("tab") && tabs.some((t) => t.id === searchParams.get("tab"))
      ? searchParams.get("tab")!
      : defaultTab;

  function setTab(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-1 sm:gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={[
              "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors sm:px-3 sm:py-1 sm:text-xs",
              active === tab.id
                ? "bg-brand text-brand-foreground shadow-sm"
                : "border border-border bg-background text-foreground/80 hover:bg-accent/30",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-1.5 min-h-0 flex-1 overflow-hidden sm:mt-2">
        {React.Children.map(children, (child) => {
          if (!React.isValidElement<{ tabId?: string }>(child)) return null;
          if (child.props.tabId !== active) return null;
          return child;
        })}
      </div>
    </div>
  );
}

export function DashboardTabPanel(props: { tabId: string; children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col overflow-hidden">{props.children}</div>;
}
