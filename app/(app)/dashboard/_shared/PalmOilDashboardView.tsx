"use client";

import { Suspense } from "react";
import type { PalmOilDashboardData } from "@/lib/dashboard/dashboard-data-types";
import { formatXaf } from "@/lib/dashboard/format";
import { DashboardChartCard } from "./DashboardChartCard";
import { DashboardLineChart } from "./charts/DashboardLineChart";
import { DashboardDonutChart } from "./charts/DashboardDonutChart";
import { DashboardMetricGrid, type MetricTile } from "./DashboardMetricGrid";
import { DashboardOverviewLayout } from "./DashboardOverviewLayout";

function chartScopeLabel(scopeHint: string, scopedSalesPointId: number | null): string {
  return scopedSalesPointId != null ? scopeHint : "All sales points";
}

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
  const scopeLabel = chartScopeLabel(data.scopeHint, data.scopedSalesPointId);
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

  return (
    <DashboardOverviewLayout
      metrics={<DashboardMetricGrid tiles={tiles} />}
      charts={
        <>
          <DashboardChartCard
            title="Sales value (current financial year)"
            subtitle={
              data.monthFilter
                ? `FY ${data.monthFilter.financialYear} · ${scopeLabel} · gross XAF by posting month`
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
                ? `FY ${data.monthFilter.financialYear} · ${scopeLabel} · count by posting month`
                : "No financial year open"
            }
          >
            <DashboardLineChart data={data.doTrend} valueLabel="Orders" />
          </DashboardChartCard>
          <DashboardChartCard
            title="Sales validation mix"
            subtitle={`Working month · ${scopeLabel}`}
          >
            <DashboardDonutChart data={data.salesStatus} />
          </DashboardChartCard>
          <DashboardChartCard
            title="Delivery order status"
            subtitle={`Working month · ${scopeLabel}`}
          >
            <DashboardDonutChart data={data.doStatus} />
          </DashboardChartCard>
        </>
      }
    />
  );
}

export function PalmOilDashboardView(props: { data: PalmOilDashboardData }) {
  return (
    <Suspense fallback={<div className="text-xs opacity-70">Loading dashboard…</div>}>
      <PalmOilDashboardBody data={props.data} />
    </Suspense>
  );
}
