"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StatusSlice } from "@/lib/dashboard/types";
import { DashboardChartFrame } from "./DashboardChartFrame";
import { useDashboardChartColors } from "./useDashboardChartColors";

export function DashboardDonutChart(props: { data: StatusSlice[] }) {
  const { data } = props;
  const chartColors = useDashboardChartColors();

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[2.5rem] items-center justify-center text-[10px] opacity-60 sm:text-xs">
        No data for this period.
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <DashboardChartFrame>
        {(size) => (
        <ResponsiveContainer width={size.width} height={size.height} minWidth={0}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="48%"
              outerRadius="72%"
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={chartColors[i % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => {
                const n = Number(value);
                const pct = total > 0 ? ((n / total) * 100).toFixed(1) : "0";
                return [`${n} (${pct}%)`, name];
              }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 11,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        )}
      </DashboardChartFrame>
      <ul className="mt-0.5 flex shrink-0 flex-wrap justify-center gap-x-2 gap-y-0.5 text-[9px] sm:text-[10px]">
        {data.map((d, i) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : "0";
          return (
            <li key={d.name} className="flex max-w-full items-center gap-1">
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full sm:h-2 sm:w-2"
                style={{ backgroundColor: chartColors[i % chartColors.length] }}
              />
              <span className="truncate">
                {d.name} {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
