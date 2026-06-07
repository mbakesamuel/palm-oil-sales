import * as React from "react";
import {
  labelCustomerTypeRow,
  type PricingProductGroup,
  type PricingScheduleRow,
} from "@/lib/pricing-report";

/**
 * Tabular rendering of pricing schedule groups, suitable for both screen and
 * print contexts. Groups are rendered as banner rows followed by their per
 * customer-type sub-rows.
 */
export function PricingScheduleTable(props: { groups: PricingProductGroup[] }) {
  const { groups } = props;
  if (groups.length === 0) {
    return <p className="text-sm opacity-75">No scheduled prices found.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg bg-background text-foreground print:break-inside-auto">
      <table className="min-w-full border-collapse border border-border text-sm print:border-black/30">
        <thead>
          <tr className="text-left">
            <th className="border border-border p-2 font-medium print:border-black/25">
              Customer type
            </th>
            <th className="border border-border p-2 text-right font-medium print:border-black/25">
              Unit price (ex tax)
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g.productId}>
              <tr className="bg-foreground/6 print:bg-black/4 print:break-inside-avoid">
                <td
                  colSpan={2}
                  className="border border-border p-2 font-semibold print:border-black/25"
                >
                  <span>{g.productName}</span>
                  <span className="ml-2 text-xs font-normal opacity-70 tabular-nums">
                    — Effective from {g.effectiveFromIso}
                  </span>
                </td>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.id} className="align-top print:break-inside-avoid">
                  <td className="border border-border p-2 pl-6 print:border-black/25">
                    {labelCustomerTypeRow(r)}
                  </td>
                  <td className="border border-border p-2 text-right tabular-nums whitespace-nowrap print:border-black/25">
                    {r.unitPriceExTax}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
