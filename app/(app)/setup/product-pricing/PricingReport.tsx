"use client";

import * as React from "react";
import { PricingScheduleTable } from "@/components/PricingScheduleTable";
import type { CustomerTypeOption } from "@/lib/customer-types/types";
import {
  buildPricingGroups,
  pickLatestPricingRows,
  type PricingScheduleRow,
} from "@/lib/pricing-report";

/** On-screen pricing-report preview. Shows latest scheduled prices grouped by product. */
export function PricingReport(props: {
  schedules: PricingScheduleRow[];
  customerTypeOptions?: CustomerTypeOption[];
}) {
  const { schedules, customerTypeOptions = [] } = props;

  const groups = React.useMemo(() => {
    return buildPricingGroups(
      pickLatestPricingRows(schedules),
      customerTypeOptions,
    );
  }, [schedules, customerTypeOptions]);

  const totalRows = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <section className="space-y-4">
      <p className="text-xs opacity-70 tabular-nums">
        Latest prices · {totalRows} row{totalRows === 1 ? "" : "s"} across{" "}
        {groups.length} product{groups.length === 1 ? "" : "s"}
      </p>

      <PricingScheduleTable groups={groups} />
    </section>
  );
}
