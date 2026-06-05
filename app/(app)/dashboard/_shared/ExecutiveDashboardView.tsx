"use client";

import Link from "next/link";
import { Suspense } from "react";
import type { ExecutiveDashboardData } from "@/lib/dashboard/dashboard-data-types";
import { formatXaf } from "@/lib/dashboard/format";
import { DashboardChartCard } from "./DashboardChartCard";
import { DashboardLineChart } from "./charts/DashboardLineChart";
import { DashboardDonutChart } from "./charts/DashboardDonutChart";
import { DashboardMetricGrid, type MetricTile } from "./DashboardMetricGrid";
import { DashboardTabPanel, DashboardTabs } from "./DashboardTabs";
import { DashboardOverviewLayout } from "./DashboardOverviewLayout";
import { DashboardFitGrid } from "./DashboardFitGrid";
import { DashboardCompactLink } from "./DashboardCompactLink";
import { DashboardCompactCard } from "./DashboardCompactCard";

function ExecutiveDashboardBody(props: { data: ExecutiveDashboardData }) {
  const { data } = props;
  const { kpis } = data;

  const tiles: MetricTile[] = [
    { label: "Sales this month", value: String(kpis.saleCount), href: "/reports/sales" },
    { label: "Gross value (XAF)", value: formatXaf(kpis.grossValue), href: "/reports/sales" },
    { label: "Pending DOs", value: String(kpis.pendingDoCount), href: "/delivery-orders" },
    { label: "Pending sales", value: String(kpis.pendingSaleCount), href: "/pos" },
    { label: "Validated rate", value: kpis.validatedRatePct != null ? `${kpis.validatedRatePct}%` : "—" },
    { label: "Commercial lines", value: String(data.lines.length) },
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
        <DashboardOverviewLayout
          metrics={<DashboardMetricGrid tiles={tiles} />}
          charts={
            <>
              <DashboardChartCard
                title="Sales value (current financial year)"
                subtitle={
                  data.monthFilter
                    ? `FY ${data.monthFilter.financialYear} · all lines · gross XAF`
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
                    ? `FY ${data.monthFilter.financialYear} · all lines`
                    : "No financial year open"
                }
              >
                <DashboardLineChart data={data.doTrend} valueLabel="Orders" />
              </DashboardChartCard>
              <DashboardChartCard title="Sales validation mix" subtitle="Working month · all lines">
                <DashboardDonutChart data={data.salesStatus} />
              </DashboardChartCard>
              <DashboardChartCard title="Sales by commercial line" subtitle="Working month">
                <DashboardDonutChart data={data.lineShare} />
              </DashboardChartCard>
            </>
          }
        />
      </DashboardTabPanel>

      <DashboardTabPanel tabId="operations">
        <DashboardFitGrid>
          {data.lines.map((line) => (
            <DashboardCompactCard
              key={line.code}
              title={line.name}
              subtitle={line.siteKind === "FACTORY" ? "Factory line" : "Sales point line"}
              action={
                <Link
                  href={line.href}
                  className="shrink-0 text-[10px] text-brand underline underline-offset-2 sm:text-xs"
                >
                  Open
                </Link>
              }
            >
              <div className="grid grid-cols-3 gap-1">
                <div className="rounded bg-brand/10 px-1 py-0.5 text-center">
                  <div className="text-sm font-semibold tabular-nums sm:text-base">{line.saleCount}</div>
                  <div className="text-[9px] opacity-75">Sales</div>
                </div>
                <div className="rounded bg-accent/25 px-1 py-0.5 text-center">
                  <div className="text-sm font-semibold tabular-nums sm:text-base">{line.pendingDoCount}</div>
                  <div className="text-[9px] opacity-75">DOs</div>
                </div>
                <div className="rounded bg-brand/15 px-1 py-0.5 text-center">
                  <div className="text-sm font-semibold tabular-nums sm:text-base">{line.pendingSaleCount}</div>
                  <div className="text-[9px] opacity-75">Pending</div>
                </div>
              </div>
            </DashboardCompactCard>
          ))}
        </DashboardFitGrid>
      </DashboardTabPanel>

      <DashboardTabPanel tabId="reports">
        <DashboardFitGrid>
          <DashboardCompactLink
            href="/reports/sales"
            title="Sales report"
            description="Invoice listing and totals."
          />
          <DashboardCompactLink
            href="/reports/daily-sales-summary"
            title="Daily sales summary"
            description="Day-by-day sales breakdown."
          />
          <DashboardCompactLink
            href="/reports/delivery-orders"
            title="Delivery orders"
            description="DO listing and status."
          />
          <DashboardCompactLink
            href="/dashboard/executive"
            title="Executive dashboard"
            description="Refresh this overview."
          />
        </DashboardFitGrid>
      </DashboardTabPanel>
    </DashboardTabs>
  );
}

export function ExecutiveDashboardView(props: { data: ExecutiveDashboardData }) {
  return (
    <Suspense fallback={<div className="text-xs opacity-70">Loading dashboard…</div>}>
      <ExecutiveDashboardBody data={props.data} />
    </Suspense>
  );
}
