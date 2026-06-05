"use client";

import { Suspense } from "react";
import type { PalmOilDashboardData } from "@/lib/dashboard/dashboard-data-types";
import { formatXaf } from "@/lib/dashboard/format";
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

function PalmOilDashboardBody(props: { data: PalmOilDashboardData }) {
  const { data } = props;

  if (data.scopeError) {
    return (
      <div className="rounded-md border border-amber-600/40 bg-amber-600/5 px-2 py-1.5 text-[10px] sm:text-xs">
        {data.scopeError}
      </div>
    );
  }

  const kpis = data.kpis!;
  const tiles: MetricTile[] = [
    {
      label: "Sales this month",
      value: String(kpis.saleCount),
      href: "/reports/sales",
    },
    {
      label: "Gross value (XAF)",
      value: formatXaf(kpis.grossValue),
      href: "/reports/sales",
    },
    {
      label: "Pending delivery orders",
      value: String(kpis.pendingDoCount),
      href: "/delivery-orders",
    },
    {
      label: "Pending sales",
      value: String(kpis.pendingSaleCount),
      href: "/pos",
    },
    {
      label: "Validated sales",
      value: String(kpis.validatedSaleCount),
    },
    {
      label: "Validation rate",
      value: kpis.validatedRatePct != null ? `${kpis.validatedRatePct}%` : "—",
    },
  ];

  if (data.stock) {
    tiles.push(
      {
        label: "Pending receipts",
        value: String(data.stock.pendingReceiptCount),
        href: "/stock?tab=receipts",
      },
      {
        label: "Pending transfers",
        value: String(data.stock.pendingTransferCount),
        href: "/stock?tab=transfers",
      },
    );
  }

  const reportLinks = quickLinksForModules(data.enabledModules).filter((l) =>
    l.href.startsWith("/reports"),
  );
  const opLinks = quickLinksForModules(data.enabledModules).filter(
    (l) => !l.href.startsWith("/reports") && !l.href.startsWith("/setup"),
  );

  return (
    <DashboardTabs
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "operations", label: "Operations" },
        { id: "reports", label: "Reports" },
      ]}
    >
      <DashboardTabPanel tabId="overview">
        <DashboardOverviewLayout
          metrics={<DashboardMetricGrid tiles={tiles} />}
          charts={
            <>
              <DashboardChartCard
                title="Sales value (current financial year)"
                subtitle={
                  data.monthFilter
                    ? `FY ${data.monthFilter.financialYear} · gross XAF by posting month`
                    : "No financial year open"
                }
              >
                <DashboardLineChart
                  data={data.salesTrend}
                  valueLabel="Gross XAF"
                  formatValue={formatXaf}
                />
              </DashboardChartCard>
              <DashboardChartCard
                title="Delivery orders (current financial year)"
                subtitle={
                  data.monthFilter
                    ? `FY ${data.monthFilter.financialYear} · count by posting month`
                    : "No financial year open"
                }
              >
                <DashboardLineChart data={data.doTrend} valueLabel="Orders" />
              </DashboardChartCard>
              <DashboardChartCard title="Sales validation mix" subtitle="Working month">
                <DashboardDonutChart data={data.salesStatus} />
              </DashboardChartCard>
              <DashboardChartCard title="Delivery order status" subtitle="Working month">
                <DashboardDonutChart data={data.doStatus} />
              </DashboardChartCard>
            </>
          }
        />
      </DashboardTabPanel>

      <DashboardTabPanel tabId="operations">
        <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden sm:gap-2">
          {data.showStock && data.stock ? (
            <>
              <div className="shrink-0">
                <DashboardMetricGrid
                  tiles={[
                    {
                      label: "Pending receipts",
                      value: String(data.stock.pendingReceiptCount),
                      href: "/stock?tab=receipts",
                    },
                    {
                      label: "Incoming transfers",
                      value: String(data.stock.incomingTransferCount),
                      href: "/stock?tab=transfers",
                    },
                    {
                      label: "Draft outbound",
                      value: String(data.stock.outboundDraftTransferCount),
                      href: "/stock?tab=transfers",
                    },
                  ]}
                />
              </div>
              <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-1.5 overflow-hidden sm:gap-2">
                <DashboardTransfersTable
                  transfers={data.incomingTransfers}
                  scopedSalesPointId={data.scopedSalesPointId}
                  scopeLabel={data.stock.scopeHint}
                />
                <DashboardFitGrid className="shrink-0 sm:max-h-[35%]">
                  {opLinks.slice(0, 4).map((link) => (
                    <DashboardCompactLink
                      key={link.href}
                      href={link.href}
                      title={link.title}
                      description={link.description}
                    />
                  ))}
                </DashboardFitGrid>
              </div>
            </>
          ) : (
            <DashboardFitGrid>
              {opLinks.slice(0, 6).map((link) => (
                <DashboardCompactLink
                  key={link.href}
                  href={link.href}
                  title={link.title}
                  description={link.description}
                />
              ))}
            </DashboardFitGrid>
          )}
        </div>
      </DashboardTabPanel>

      <DashboardTabPanel tabId="reports">
        <DashboardFitGrid>
          {(reportLinks.length > 0 ? reportLinks : quickLinksForModules(data.enabledModules))
            .slice(0, 8)
            .map((link) => (
              <DashboardCompactLink
                key={link.href}
                href={link.href}
                title={link.title}
                description={link.description}
              />
            ))}
        </DashboardFitGrid>
      </DashboardTabPanel>
    </DashboardTabs>
  );
}

export function PalmOilDashboardView(props: { data: PalmOilDashboardData }) {
  return (
    <Suspense fallback={<div className="text-xs opacity-70">Loading dashboard…</div>}>
      <PalmOilDashboardBody data={props.data} />
    </Suspense>
  );
}
