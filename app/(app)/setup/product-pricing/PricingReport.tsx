"use client";

import * as React from "react";
import { OpenReportButton } from "@/components/OpenReportButton";
import { PricingScheduleTable } from "@/components/PricingScheduleTable";
import {
  buildPricingGroups,
  pickLatestPricingRows,
  type PricingScheduleRow,
} from "@/lib/pricing-report";

/**
 * On-screen pricing-report preview. Renders a date filter and the scheduled
 * prices grouped by product. The printable copy lives at `printHref`
 * and is opened via `OpenReportButton`.
 */
export function PricingReport(props: {
  schedules: PricingScheduleRow[];
  /** Print route to open in a new tab when the user clicks Print. */
  printHref: string;
}) {
  const { schedules, printHref } = props;
  const [effectiveFromIso, setEffectiveFromIso] = React.useState("");

  const groups = React.useMemo(() => {
    const base =
      effectiveFromIso.trim() !== ""
        ? schedules.filter((r) => r.effectiveFromIso === effectiveFromIso.trim())
        : pickLatestPricingRows(schedules);
    return buildPricingGroups(base);
  }, [effectiveFromIso, schedules]);

  const totalRows = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-xs opacity-70 tabular-nums">
          Effective from{" "}
          <span className="font-medium">
            {effectiveFromIso.trim() ? effectiveFromIso : "Latest"}
          </span>
          {" · "}
          {totalRows} row{totalRows === 1 ? "" : "s"} across {groups.length}{" "}
          product{groups.length === 1 ? "" : "s"}
        </p>
        <div className="flex flex-col items-start gap-2">
          <div className="grid gap-1">
            <label htmlFor="pricing-effective-from" className="text-sm font-medium">
              Effective from
            </label>
            <input
              id="pricing-effective-from"
              type="date"
              value={effectiveFromIso}
              onChange={(e) => setEffectiveFromIso(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
            <p className="text-xs opacity-70">
              Leave blank to show latest per product/customer.
            </p>
          </div>
          <OpenReportButton
            href={printHref}
            params={{ effectiveFrom: effectiveFromIso }}
            label="Print report"
          />
        </div>
      </div>

      <PricingScheduleTable groups={groups} />
    </section>
  );
}
