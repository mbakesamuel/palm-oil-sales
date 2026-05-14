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
  if (!ct) return "—";
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

function normalizeName(s: string) {
  return s.trim().toLowerCase();
}

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

export function PricingReport(props: {
  companyName: string;
  department: string | null;
  logoUrl?: string | null;
  schedules: ScheduleRow[];
}) {
  const { companyName, department, logoUrl, schedules } = props;
  const generated = new Date();
  const [effectiveFromIso, setEffectiveFromIso] = React.useState("");

  const rows = React.useMemo(() => {
    const base =
      effectiveFromIso.trim() !== ""
        ? schedules.filter((r) => r.effectiveFromIso === effectiveFromIso.trim())
        : pickLatestRows(schedules);

    return [...base].sort((a, b) => {
      if (a.productName !== b.productName) {
        return a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" });
      }
      const ca = labelCustomerType(a.customerType);
      const cb = labelCustomerType(b.customerType);
      if (ca !== cb) return ca.localeCompare(cb, undefined, { sensitivity: "base" });
      return b.unitPriceExTax.localeCompare(a.unitPriceExTax);
    });
  }, [effectiveFromIso, schedules]);

  const LPO_NAME = "loose palm oil";
  const loosePalmOil = rows.filter((r) => normalizeName(r.productName) === LPO_NAME);
  const otherProducts = rows.filter((r) => normalizeName(r.productName) !== LPO_NAME);

  function Section(props: { title: string; rows: ScheduleRow[] }) {
    return (
      <section className="space-y-2 print:break-inside-avoid">
        <h3 className="text-base font-semibold">{props.title}</h3>
        {props.rows.length === 0 ? (
          <p className="text-sm opacity-75">No rows.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-background text-foreground">
            <table className="min-w-full border-collapse border border-border text-sm print:border-black/30">
              <thead>
                <tr className="text-left">
                  <th className="border border-border p-2 font-medium print:border-black/25">
                    Product
                  </th>
                  <th className="border border-border p-2 font-medium print:border-black/25">
                    Customer type
                  </th>
                  <th className="border border-border p-2 text-right font-medium print:border-black/25">
                    Unit price (ex tax)
                  </th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="border border-border p-2 print:border-black/25">
                      {r.productName}
                    </td>
                    <td className="border border-border p-2 print:border-black/25">
                      {labelCustomerType(r.customerType)}
                    </td>
                    <td className="border border-border p-2 text-right tabular-nums whitespace-nowrap print:border-black/25">
                      {r.unitPriceExTax}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

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
            <span className="font-medium">{effectiveFromIso.trim() ? effectiveFromIso : "Latest"}</span>
            {" · "}
            {rows.length} row{rows.length === 1 ? "" : "s"}
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
            <p className="text-xs opacity-70">Leave blank to show latest per product/customer.</p>
          </div>
          <PrintButton label="Print report" />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm opacity-75">No scheduled prices found.</p>
      ) : (
        <div className="space-y-6">
          <Section title="Loose Palm Oil" rows={loosePalmOil} />
          <Section title="Other products" rows={otherProducts} />
        </div>
      )}
    </section>
  );
}

