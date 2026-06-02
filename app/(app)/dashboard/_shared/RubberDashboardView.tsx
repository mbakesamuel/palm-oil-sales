"use client";

import { Suspense } from "react";
import type { RubberDashboardData } from "@/lib/dashboard/dashboard-data-types";
import { quickLinksForModules } from "@/lib/dashboard-widgets";
import { DashboardChartCard } from "./DashboardChartCard";
import { DashboardLineChart } from "./charts/DashboardLineChart";
import { DashboardDonutChart } from "./charts/DashboardDonutChart";
import { DashboardMetricGrid, type MetricTile } from "./DashboardMetricGrid";
import { DashboardTabPanel, DashboardTabs } from "./DashboardTabs";
import { DashboardOverviewLayout } from "./DashboardOverviewLayout";
import { DashboardFitGrid } from "./DashboardFitGrid";
import { DashboardCompactLink } from "./DashboardCompactLink";
import { DashboardTransfersTable } from "./DashboardTransfersTable";

function RubberDashboardBody(props: { data: RubberDashboardData }) {
  const { data } = props;
  const stock = data.stock;

  const tiles: MetricTile[] = stock
    ? [
        {
          label: "Pending receipts",
          value: String(stock.pendingReceiptCount),
          href: "/stock?tab=receipts",
        },
        {
          label: "Pending transfers",
          value: String(stock.pendingTransferCount),
          href: "/stock?tab=transfers",
        },
        {
          label: "Incoming",
          value: String(stock.incomingTransferCount),
          href: "/stock?tab=transfers",
        },
        {
          label: "Draft outbound",
          value: String(stock.outboundDraftTransferCount),
          href: "/stock?tab=transfers",
        },
      ]
    : [{ label: "Stock access", value: "—" }];

  const links = quickLinksForModules(data.enabledModules);

  return (
    <DashboardTabs
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "operations", label: "Operations" },
        { id: "reports", label: "Reports" },
      ]}
    >
      <DashboardTabPanel tabId="overview">
        {data.showStock ? (
          <DashboardOverviewLayout
            chartCount={2}
            metrics={<DashboardMetricGrid tiles={tiles} />}
            charts={
              <>
                <DashboardChartCard title="Stock transfers (last 12 months)" subtitle="Created transfers">
                  <DashboardLineChart data={data.transferTrend} valueLabel="Transfers" />
                </DashboardChartCard>
                <DashboardChartCard title="Transfer status mix" subtitle="Current scope">
                  <DashboardDonutChart data={data.transferStatus} />
                </DashboardChartCard>
              </>
            }
          />
        ) : (
          <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
            <DashboardMetricGrid tiles={tiles} />
            <p className="text-[10px] opacity-70 sm:text-xs">Stock metrics require stock module access.</p>
          </div>
        )}
      </DashboardTabPanel>

      <DashboardTabPanel tabId="operations">
        <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden sm:gap-2">
          {data.showStock && stock ? (
            <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-1.5 overflow-hidden sm:gap-2">
              <DashboardTransfersTable
                transfers={data.incomingTransfers}
                scopedSalesPointId={data.scopedSalesPointId}
                scopeLabel={stock.scopeHint}
              />
              <DashboardFitGrid className="shrink-0 sm:max-h-[40%]">
                {links.slice(0, 4).map((link) => (
                  <DashboardCompactLink
                    key={link.href}
                    href={link.href}
                    title={link.title}
                    description={link.description}
                  />
                ))}
              </DashboardFitGrid>
            </div>
          ) : null}
        </div>
      </DashboardTabPanel>

      <DashboardTabPanel tabId="reports">
        <DashboardFitGrid>
          <DashboardCompactLink
            href="/reports/stock-on-hand"
            title="Stock on hand"
            description="Current inventory levels."
          />
          <DashboardCompactLink
            href="/rubber"
            title="Rubber sales"
            description="Factory rubber operations."
          />
        </DashboardFitGrid>
      </DashboardTabPanel>
    </DashboardTabs>
  );
}

export function RubberDashboardView(props: { data: RubberDashboardData }) {
  return (
    <Suspense fallback={<div className="text-xs opacity-70">Loading dashboard…</div>}>
      <RubberDashboardBody data={props.data} />
    </Suspense>
  );
}
