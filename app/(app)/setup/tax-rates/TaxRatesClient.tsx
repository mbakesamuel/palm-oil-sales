"use client";

import * as React from "react";
import Link from "next/link";
import { TaxRateVariant } from "@prisma/client";
import { TAX_RATE_VARIANT_LABELS, salesTaxVariantHint } from "@/lib/tax/variant-labels";

type ScheduleRow = {
  id: string;
  variant: TaxRateVariant;
  rate: string;
  effectiveFromIso: string;
};

type SalesTaxSection = {
  variant: TaxRateVariant;
  currentRatePercent: string | null;
  history: ScheduleRow[];
};

export function TaxRatesClient(props: {
  vatCurrentPercent: string | null;
  vatHistory: ScheduleRow[];
  salesTaxSections: SalesTaxSection[];
  saveVatRateAction: (formData: FormData) => void | Promise<void>;
  saveSalesTaxRateAction: (formData: FormData) => void | Promise<void>;
}) {
  const {
    vatCurrentPercent,
    vatHistory,
    salesTaxSections,
    saveVatRateAction,
    saveSalesTaxRateAction,
  } = props;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tax rates</h1>
        <p className="text-sm opacity-75">
          Schedule VAT and sales tax rates with effective dates. POS and delivery orders use the
          rate in force on the transaction date. Assign customers to regimes under{" "}
          <Link href="/tax-regimes" className="underline underline-offset-4">
            Tax regimes
          </Link>{" "}
          and{" "}
          <Link href="/customers" className="underline underline-offset-4">
            Customers
          </Link>
          .
        </p>
      </div>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <div>
          <h2 className="text-lg font-semibold">VAT (local customers)</h2>
          <p className="text-xs opacity-70 mt-1">
            Applied to local customers on eligible sales. Overseas customers are exempt.
          </p>
          {vatCurrentPercent != null ? (
            <p className="text-sm mt-2">
              Current rate: <span className="font-medium">{vatCurrentPercent}%</span>
            </p>
          ) : (
            <p className="text-sm mt-2 text-amber-700 dark:text-amber-400">
              No VAT schedule found. Add a rate below.
            </p>
          )}
        </div>

        <form
          action={saveVatRateAction}
          className="grid gap-3 sm:grid-cols-2 max-w-xl"
        >
          <div className="grid gap-1">
            <label className="text-sm font-medium" htmlFor="vat-rate">
              New rate (%)
            </label>
            <input
              id="vat-rate"
              name="ratePercent"
              type="text"
              inputMode="decimal"
              placeholder={vatCurrentPercent ?? "19.25"}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium" htmlFor="vat-effective">
              Effective from
            </label>
            <input
              id="vat-effective"
              name="effectiveFrom"
              type="date"
              defaultValue={today}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
            <p className="text-[11px] opacity-70">Leave blank on General Parameters = today.</p>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
            >
              Save VAT rate
            </button>
          </div>
        </form>

        {vatHistory.length > 0 ? (
          <RateHistoryTable rows={vatHistory} />
        ) : null}
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Sales tax (local, non-industry)</h2>
          <p className="text-xs opacity-70 mt-1">
            Rate depends on the customer&apos;s tax regime (or no regime). Industry customers are
            exempt from sales tax.
          </p>
        </div>

        {salesTaxSections.map((section) => (
          <div
            key={section.variant}
            className="space-y-3 rounded-lg border border-border p-4"
          >
            <div>
              <h3 className="font-medium">{TAX_RATE_VARIANT_LABELS[section.variant]}</h3>
              <p className="text-xs opacity-70">{salesTaxVariantHint(section.variant)}</p>
              {section.currentRatePercent != null ? (
                <p className="text-sm mt-1">
                  Current rate:{" "}
                  <span className="font-medium">{section.currentRatePercent}%</span>
                </p>
              ) : (
                <p className="text-sm mt-1 text-amber-700 dark:text-amber-400">
                  No rate scheduled. Add one below.
                </p>
              )}
            </div>

            <form
              action={saveSalesTaxRateAction}
              className="grid gap-3 sm:grid-cols-2 max-w-xl"
            >
              <input type="hidden" name="variant" value={section.variant} />
              <div className="grid gap-1">
                <label className="text-sm font-medium">New rate (%)</label>
                <input
                  name="ratePercent"
                  type="text"
                  inputMode="decimal"
                  placeholder={section.currentRatePercent ?? "5"}
                  className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Effective from</label>
                <input
                  name="effectiveFrom"
                  type="date"
                  defaultValue={today}
                  className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
                >
                  Save rate
                </button>
              </div>
            </form>

            {section.history.length > 0 ? (
              <RateHistoryTable rows={section.history} />
            ) : null}
          </div>
        ))}
      </section>

      <p className="text-xs opacity-70">
        Advanced: manage additional tax types and raw schedule rows under{" "}
        <Link href="/tax-types" className="underline underline-offset-4">
          Tax types
        </Link>
        .
      </p>
    </div>
  );
}

function rateToPercent(rate: string): string {
  const n = Number.parseFloat(rate);
  if (!Number.isFinite(n)) return rate;
  return (n * 100).toFixed(2).replace(/\.?0+$/, "");
}

function RateHistoryTable({ rows }: { rows: ScheduleRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border text-left opacity-70">
            <th className="py-1 pr-3">Effective from</th>
            <th className="py-1 pr-3">Variant</th>
            <th className="py-1">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/50">
              <td className="py-1 pr-3 font-mono">{r.effectiveFromIso}</td>
              <td className="py-1 pr-3">{TAX_RATE_VARIANT_LABELS[r.variant] ?? r.variant}</td>
              <td className="py-1">{rateToPercent(r.rate)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
