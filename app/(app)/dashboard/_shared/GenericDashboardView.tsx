"use client";

import { Suspense } from "react";
import type { GenericDashboardData } from "@/lib/dashboard/dashboard-data-types";
import { DashboardMetricGrid, type MetricTile } from "./DashboardMetricGrid";
import { DashboardTabPanel, DashboardTabs } from "./DashboardTabs";
import { DashboardFitGrid } from "./DashboardFitGrid";
import { DashboardCompactLink } from "./DashboardCompactLink";

function GenericDashboardBody(props: { data: GenericDashboardData }) {
  const { data } = props;

  const tiles: MetricTile[] = [
    { label: "Commercial line", value: data.serviceName },
    { label: "Enabled modules", value: String(data.moduleCount) },
    {
      label: "Working month",
      value: data.monthFilter?.label ?? "—",
    },
  ];

  return (
    <DashboardTabs
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "operations", label: "Operations" },
        { id: "reports", label: "Reports" },
      ]}
    >
      <DashboardTabPanel tabId="overview">
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
          <div className="shrink-0">
            <DashboardMetricGrid tiles={tiles} />
          </div>
          <p className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-background p-2 text-center text-[10px] opacity-80 shadow-sm sm:text-xs">
            Choose a module from the sidebar or use the quick links on the Operations tab.
          </p>
        </div>
      </DashboardTabPanel>

      <DashboardTabPanel tabId="operations">
        <DashboardFitGrid>
          {data.quickLinks.map((link) => (
            <DashboardCompactLink
              key={link.href}
              href={link.href}
              title={link.title}
              description={link.description}
            />
          ))}
        </DashboardFitGrid>
      </DashboardTabPanel>

      <DashboardTabPanel tabId="reports">
        <DashboardFitGrid>
          <DashboardCompactLink
            href="/reports"
            title="All reports"
            description="Browse printable operational reports."
          />
        </DashboardFitGrid>
      </DashboardTabPanel>
    </DashboardTabs>
  );
}

export function GenericDashboardView(props: { data: GenericDashboardData }) {
  return (
    <Suspense fallback={<div className="text-xs opacity-70">Loading dashboard…</div>}>
      <GenericDashboardBody data={props.data} />
    </Suspense>
  );
}
