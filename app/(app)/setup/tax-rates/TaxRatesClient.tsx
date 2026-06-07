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

const inputClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm";
const labelClass = "text-xs font-medium";
const hintClass = "text-[11px] opacity-70 mt-0.5";
const fieldRowClass = "flex items-start gap-2";
const fieldLabelClass = [
  labelClass,
  "shrink-0 w-[7.25rem] h-8",
  "flex items-center justify-end px-2",
  "rounded-md border border-border",
  "bg-sidebar text-sidebar-foreground",
].join(" ");
const fieldControlClass = "min-w-0 flex-1";
const formActionsClass =
  "flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]";

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
          Set VAT and sales tax percentages with effective dates. This is the only
          place to change rates for the built-in{" "}
          <span className="font-medium">VAT</span> and{" "}
          <span className="font-medium">Sales tax</span> types. POS and delivery
          orders use the rate in force on the transaction date. Link taxes to
          regimes on{" "}
          <Link href="/tax-regimes" className="underline underline-offset-4">
            Tax regimes
          </Link>
          ; assign customers on{" "}
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

        <form action={saveVatRateAction} className="max-w-xl space-y-1.5">
          <div className={fieldRowClass}>
            <label className={fieldLabelClass} htmlFor="vat-rate">
              New rate
            </label>
            <div className={fieldControlClass}>
              <div className="flex h-8 items-center gap-2">
                <input
                  id="vat-rate"
                  name="ratePercent"
                  type="text"
                  inputMode="decimal"
                  placeholder={vatCurrentPercent ?? "19.25"}
                  className={`${inputClass} max-w-28`}
                  required
                />
                <span className="text-xs opacity-70 shrink-0">%</span>
              </div>
              <p className={hintClass}>Percentage applied to eligible local sales.</p>
            </div>
          </div>

          <div className={fieldRowClass}>
            <label className={fieldLabelClass} htmlFor="vat-effective">
              Effective
            </label>
            <div className={fieldControlClass}>
              <input
                id="vat-effective"
                name="effectiveFrom"
                type="date"
                defaultValue={today}
                className={`${inputClass} max-w-44`}
              />
              <p className={hintClass}>Leave blank to use today.</p>
            </div>
          </div>

          <div className={formActionsClass}>
            <button
              type="submit"
              className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
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

            <form action={saveSalesTaxRateAction} className="max-w-xl space-y-1.5">
              <input type="hidden" name="variant" value={section.variant} />

              <div className={fieldRowClass}>
                <label
                  className={fieldLabelClass}
                  htmlFor={`sat-rate-${section.variant}`}
                >
                  New rate
                </label>
                <div className={fieldControlClass}>
                  <div className="flex h-8 items-center gap-2">
                    <input
                      id={`sat-rate-${section.variant}`}
                      name="ratePercent"
                      type="text"
                      inputMode="decimal"
                      placeholder={section.currentRatePercent ?? "5"}
                      className={`${inputClass} max-w-28`}
                      required
                    />
                    <span className="text-xs opacity-70 shrink-0">%</span>
                  </div>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label
                  className={fieldLabelClass}
                  htmlFor={`sat-effective-${section.variant}`}
                >
                  Effective
                </label>
                <div className={fieldControlClass}>
                  <input
                    id={`sat-effective-${section.variant}`}
                    name="effectiveFrom"
                    type="date"
                    defaultValue={today}
                    className={`${inputClass} max-w-44`}
                    required
                  />
                </div>
              </div>

              <div className={formActionsClass}>
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
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
        Need another levy beyond VAT and sales tax? Add the tax type under{" "}
        <Link href="/tax-types" className="underline underline-offset-4">
          Tax types
        </Link>
        , schedule its rates there, then link it to regimes.
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
