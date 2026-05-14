"use client";

import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";

type VariantRow = {
  id: string;
  productName: string;
  name: string;
  unitLabel: string;
  unitQuantity: string | null;
  isActive: boolean;
};

type PriceRow = {
  id: string;
  variantLabel: string;
  effectiveFromIso: string;
  unitPriceExTax: string;
};

export function BpoPricingReportView(props: {
  companyName: string;
  department: string | null;
  logoUrl?: string | null;
  variants: VariantRow[];
  prices: PriceRow[];
}) {
  const { companyName, department, logoUrl, variants, prices } = props;

  return (
    <div className="space-y-8">
      <div className="hidden print:block">
        <ReportHeader
          companyName={companyName}
          department={department}
          logoSrc={logoUrl}
          title="Bottled Palm Oil variant pricing"
        />
      </div>

      <div className="space-y-1 print:hidden">
        <h1 className="text-2xl font-semibold">Bottled Palm Oil pricing</h1>
        <p className="text-sm opacity-75">
          Variant sizes and scheduled ex-tax unit prices. Use Print for your browser’s print dialog.
        </p>
      </div>

      <div className="flex flex-wrap justify-end print:hidden">
        <PrintButton label="Print report" />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Variants</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          {variants.map((v) => (
            <div
              key={v.id}
              className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b border-border last:border-0"
            >
              <div className="col-span-4 font-medium">
                {v.productName} - {v.name}
              </div>
              <div className="col-span-3 opacity-75">
                {v.unitLabel}
                {v.unitQuantity ? ` (${v.unitQuantity})` : ""}
              </div>
              <div className="col-span-5">{v.isActive ? "Active" : "Inactive"}</div>
            </div>
          ))}
          {variants.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No BPO variants configured.</div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Price schedules</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          {prices.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b border-border last:border-0"
            >
              <div className="col-span-6 font-medium">{p.variantLabel}</div>
              <div className="col-span-3 tabular-nums">{p.effectiveFromIso}</div>
              <div className="col-span-3 text-right tabular-nums">{p.unitPriceExTax}</div>
            </div>
          ))}
          {prices.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No variant price rows yet.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
