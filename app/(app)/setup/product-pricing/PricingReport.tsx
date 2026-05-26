"use client";

import * as React from "react";
import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";
import { CustomerType } from "@/lib/domain";

type ScheduleRow = {
  id: string;
  productId: number;
  productName: string;
  productCatId: number;
  customerType: string | null;
  effectiveFromIso: string;
  unitPriceExTax: string;
};

function labelCustomerType(ct: string | null) {
  if (!ct) return "Direct price";
  switch (ct) {
    case CustomerType.INDUSTRY:
      return "Industry";
    case CustomerType.WHOLE_SALE:
      return "Wholesale";
    case CustomerType.RETAIL:
      return "Retail";
    case CustomerType.WORKER:
      return "Worker";
    default:
      return ct;
  }
}

/** Stable ordering for customer-type rows within a product group. */
const CUSTOMER_TYPE_ORDER: Record<string, number> = {
  [CustomerType.INDUSTRY]: 0,
  [CustomerType.WHOLE_SALE]: 1,
  [CustomerType.RETAIL]: 2,
  [CustomerType.WORKER]: 3,
};

function customerTypeRank(ct: string | null): number {
  if (!ct) return -1;
  return CUSTOMER_TYPE_ORDER[ct] ?? 99;
}

/** Reduces a flat list of price-schedule rows to the latest row per (product, customerType). */
function pickLatestRows(rows: ScheduleRow[]): ScheduleRow[] {
  const bestByKey = new Map<string, ScheduleRow>();
  for (const r of rows) {
    const k = `${r.productId}:${r.customerType ?? ""}`;
    const prev = bestByKey.get(k);
    if (!prev) {
      bestByKey.set(k, r);
      continue;
    }
    if (r.effectiveFromIso > prev.effectiveFromIso) bestByKey.set(k, r);
  }
  return [...bestByKey.values()];
}

type ProductGroup = {
  productId: number;
  productName: string;
  /** Latest effective date across all rows of this product. */
  effectiveFromIso: string;
  rows: ScheduleRow[];
};

function buildGroups(rows: ScheduleRow[]): ProductGroup[] {
  const byProduct = new Map<number, ProductGroup>();
  for (const r of rows) {
    const existing = byProduct.get(r.productId);
    if (!existing) {
      byProduct.set(r.productId, {
        productId: r.productId,
        productName: r.productName,
        effectiveFromIso: r.effectiveFromIso,
        rows: [r],
      });
      continue;
    }
    existing.rows.push(r);
    if (r.effectiveFromIso > existing.effectiveFromIso) {
      existing.effectiveFromIso = r.effectiveFromIso;
    }
  }
  const groups = [...byProduct.values()];
  for (const g of groups) {
    g.rows.sort(
      (a, b) => customerTypeRank(a.customerType) - customerTypeRank(b.customerType),
    );
  }
  groups.sort((a, b) =>
    a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" }),
  );
  return groups;
}

export function PricingReport(props: {
  companyName: string;
  department: string | null;
  logoUrl?: string | null;
  schedules: ScheduleRow[];
}) {
  const { companyName, department, logoUrl, schedules } = props;
  const generated = new Date();
  const [effectiveFromIso, setEffectiveFromIso] = React.useState("");

  const groups = React.useMemo(() => {
    const base =
      effectiveFromIso.trim() !== ""
        ? schedules.filter((r) => r.effectiveFromIso === effectiveFromIso.trim())
        : pickLatestRows(schedules);
    return buildGroups(base);
  }, [effectiveFromIso, schedules]);

  const totalRows = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <section className="space-y-4 print:space-y-3">
      <div className="print:block">
        <ReportHeader
          companyName={companyName}
          department={department}
          logoSrc={logoUrl}
          title="Pricing report"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
        <div>
          <p className="text-xs opacity-70 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {" · "}
            Effective from{" "}
            <span className="font-medium">
              {effectiveFromIso.trim() ? effectiveFromIso : "Latest"}
            </span>
            {" · "}
            {totalRows} row{totalRows === 1 ? "" : "s"} across {groups.length} product
            {groups.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="print:hidden flex flex-col items-start gap-2">
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
          <PrintButton label="Print report" />
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm opacity-75">No scheduled prices found.</p>
      ) : (
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
                        {labelCustomerType(r.customerType)}
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
      )}
    </section>
  );
}
