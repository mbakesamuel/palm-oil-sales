"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/dashboard/types";
import { DashboardChartFrame } from "./DashboardChartFrame";
import { useDashboardChartColors } from "./useDashboardChartColors";

export function DashboardLineChart(props: {
  data: TrendPoint[];
  valueLabel?: string;
  formatValue?: (n: number) => string;
}) {
  const { data, valueLabel = "Value", formatValue = (n) => String(n) } = props;
  const chartColors = useDashboardChartColors();
  const lineColor = chartColors[0] ?? "#1b5e34";

  if (data.every((d) => d.value === 0)) {
    return (
      <div className="flex h-full min-h-[2.5rem] items-center justify-center text-[10px] opacity-60 sm:text-xs">
        No data for this period.
      </div>
    );
  }

  return (
    <DashboardChartFrame>
      {(size) => (
      <ResponsiveContainer width={size.width} height={size.height} minWidth={0}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 8 }}
            interval="preserveStartEnd"
            stroke="currentColor"
            opacity={0.6}
          />
          <YAxis
            tick={{ fontSize: 8 }}
            width={36}
            stroke="currentColor"
            opacity={0.6}
            tickFormatter={(v) => formatValue(Number(v))}
          />
          <Tooltip
            formatter={(value) => [formatValue(Number(value)), valueLabel]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={{ r: 2, fill: lineColor }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
      )}
    </DashboardChartFrame>
  );
}
