"use client";

import { Suspense } from "react";
import type { ExecutiveDashboardData } from "@/lib/dashboard/dashboard-data-types";
import { formatXaf } from "@/lib/dashboard/format";
import { DashboardChartCard } from "./DashboardChartCard";
import { DashboardLineChart } from "./charts/DashboardLineChart";
import { DashboardDonutChart } from "./charts/DashboardDonutChart";
import { DashboardMetricGrid, type MetricTile } from "./DashboardMetricGrid";
import { DashboardOverviewLayout } from "./DashboardOverviewLayout";

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
  );
}

export function ExecutiveDashboardView(props: { data: ExecutiveDashboardData }) {
  return (
    <Suspense fallback={<div className="text-xs opacity-70">Loading dashboard…</div>}>
      <ExecutiveDashboardBody data={props.data} />
    </Suspense>
  );
}
