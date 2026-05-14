"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatFinancialYearLabel, monthName } from "@/lib/fiscal";
import {
  formatPhasedQtyKgDisplay,
  formatPhasedRevenueDisplay,
  type SalesBudgetPhaseResult,
} from "@/lib/sales-budget-phase";
import {
  deleteProductSalesBudget,
  previewSalesBudgetPhaseAction,
  saveSalesBudgetPhaseProfile,
  upsertProductSalesBudget,
} from "./actions";

type PeriodRow = {
  financialYear: number;
  startDate: Date;
  endDate: Date;
  status: string;
};

type ProductRow = {
  productId: number;
  productName: string;
  productCode: string | null;
};

type FiscalMonthLabel = { financialMonth: number; label: string };

function padPhasePctRow(pcts: string[]): string[] {
  return Array.from({ length: 12 }, (_, i) => pcts[i] ?? "0");
}

function sumEnteredPercents(values: string[]): number {
  let s = 0;
  for (const v of values) {
    const t = String(v ?? "").trim().replace(",", ".");
    if (!t) continue;
    const n = Number.parseFloat(t);
    if (Number.isFinite(n)) s += n;
  }
  return s;
}

/** Same order of magnitude as server action tolerance (±0.02%). */
const PCT_SUM_OK_EPS = 0.02;

function ProductPhasePctEditor(props: {
  financialYear: number;
  productId: number;
  fiscalMonthLabels: FiscalMonthLabel[];
  /** Changes when server-sent percentages change (e.g. after refresh). */
  serverPctKey: string;
  initialPcts: string[];
  onAfterSave: () => void;
  onAfterSaveError: (e: unknown) => void;
}) {
  const {
    financialYear,
    productId,
    fiscalMonthLabels,
    serverPctKey,
    initialPcts,
    onAfterSave,
    onAfterSaveError,
  } = props;

  const [values, setValues] = React.useState(() => padPhasePctRow(initialPcts));

  React.useEffect(() => {
    setValues(padPhasePctRow(initialPcts));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when serverPctKey changes (initialPcts matches that snapshot)
  }, [serverPctKey]);

  const total = sumEnteredPercents(values);
  const sumOk = Math.abs(total - 100) <= PCT_SUM_OK_EPS;

  return (
    <form
      className="space-y-2"
      action={async (formData) => {
        try {
          await saveSalesBudgetPhaseProfile(formData);
          onAfterSave();
        } catch (e) {
          onAfterSaveError(e);
        }
      }}
    >
      <input type="hidden" name="financialYear" value={financialYear} />
      <input type="hidden" name="productId" value={productId} />
      <div className="grid gap-2 sm:grid-cols-2 max-h-64 overflow-y-auto pr-1">
        {fiscalMonthLabels.map((row, idx) => {
          const name = `pctM${String(row.financialMonth).padStart(2, "0")}`;
          const fieldId = `pct-${productId}-${name}`;
          return (
            <div key={row.financialMonth} className="grid gap-0.5">
              <label className="text-[11px] font-medium" htmlFor={fieldId}>
                FY mo {row.financialMonth} · {row.label}
              </label>
              <div className="flex items-center gap-1">
                <input
                  id={fieldId}
                  name={name}
                  type="text"
                  inputMode="decimal"
                  required
                  value={values[idx] ?? ""}
                  onChange={(e) => {
                    const next = [...values];
                    next[idx] = e.target.value;
                    setValues(next);
                  }}
                  className="w-full rounded-md border border-border bg-transparent px-1.5 py-1 text-xs tabular-nums"
                />
                <span className="text-[10px] opacity-60">%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div
        className={[
          "rounded-md border px-2 py-1.5 text-xs font-medium tabular-nums",
          sumOk
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
        ].join(" ")}
      >
        Total: {total.toFixed(2)}%{" "}
        <span className="font-normal opacity-90">
          {sumOk ? "(100% — OK to save)" : "(must total 100% to save)"}
        </span>
      </div>
      <button
        type="submit"
        className="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent/25"
      >
        Save phasing
      </button>
    </form>
  );
}

export function SalesBudgetClient(props: {
  periods: PeriodRow[];
  selectedFinancialYear: number | null;
  fiscalYearStartMonth: number;
  fiscalMonthLabels: { financialMonth: number; label: string }[];
  profilePctsByProduct: Record<number, string[]>;
  products: ProductRow[];
  budgetByProduct: Record<
    number,
    { annualQtyKg: string; budgetUnitPricePerKg: string }
  >;
}) {
  const {
    periods,
    selectedFinancialYear,
    fiscalYearStartMonth,
    fiscalMonthLabels,
    profilePctsByProduct,
    products,
    budgetByProduct,
  } = props;

  const router = useRouter();
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<SalesBudgetPhaseResult | null>(
    null,
  );
  const [previewBusy, setPreviewBusy] = React.useState(false);

  const [previewProductId, setPreviewProductId] = React.useState<string>(
    products[0] ? String(products[0].productId) : "",
  );
  const [previewQty, setPreviewQty] = React.useState("");
  const [previewPrice, setPreviewPrice] = React.useState("");

  /** Keep preview product id valid when the product list or FY changes (avoids invalid <select> value). */
  React.useEffect(() => {
    if (products.length === 0) {
      setPreviewProductId("");
      return;
    }
    const ids = new Set(products.map((p) => p.productId));
    const cur = Number.parseInt(previewProductId, 10);
    if (!previewProductId || !Number.isFinite(cur) || !ids.has(cur)) {
      setPreviewProductId(String(products[0]!.productId));
    }
  }, [products, previewProductId]);

  React.useEffect(() => {
    if (!previewProductId) {
      setPreviewQty("");
      setPreviewPrice("");
      return;
    }
    const id = Number.parseInt(previewProductId, 10);
    if (!Number.isFinite(id)) return;
    const b = budgetByProduct[id];
    if (b) {
      setPreviewQty(b.annualQtyKg);
      setPreviewPrice(b.budgetUnitPricePerKg);
    } else {
      setPreviewQty("");
      setPreviewPrice("");
    }
  }, [previewProductId, selectedFinancialYear, budgetByProduct]);

  function flashError(e: unknown) {
    setError(e instanceof Error ? e.message : String(e));
    setMessage(null);
  }

  function flashOk(text: string) {
    setMessage(text);
    setError(null);
  }

  const fy = selectedFinancialYear;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sales budget Phasing</h1>
        <p className="text-sm opacity-75 max-w-3xl">
          Set budgeted annual quantity (kg) and unit price per kg per product
          for each financial year. Each product has its own monthly phasing
          percentages for that year; quantities are phased into fiscal months
          using that distribution, then spread across each calendar day. Revenue
          follows phased quantity × price at each level (XAF, 2 dp).
        </p>
      </div>

      {periods.length === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          No financial years exist yet. Add one under Financial years before
          entering budgets.
        </p>
      ) : null}

      {fy != null ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium" htmlFor="fySelect">
              Financial year
            </label>
            <select
              id="fySelect"
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm min-w-56"
              value={fy}
              onChange={(e) => {
                const v = e.target.value;
                router.push(`/setup/sales-budget?fy=${encodeURIComponent(v)}`);
                router.refresh();
              }}
            >
              {periods.map((p) => (
                <option key={p.financialYear} value={p.financialYear}>
                  {formatFinancialYearLabel(
                    p.financialYear,
                    fiscalYearStartMonth,
                  )}{" "}
                  ({p.status})
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs opacity-70">
            Fiscal start:{" "}
            <span className="font-medium">
              {monthName(fiscalYearStartMonth)}
            </span>
          </div>
        </div>
      ) : null}

      {(error || message) && (
        <div
          className={[
            "rounded-md border px-3 py-2 text-sm",
            error
              ? "border-red-500/40 bg-red-500/10"
              : "border-emerald-500/40 bg-emerald-500/10",
          ].join(" ")}
        >
          {error ?? message}
        </div>
      )}

      {fy != null && products.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Annual budgets by product</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">Product</th>
                  <th className="p-2 font-medium">
                    Annual qty (kg), budget XAF/kg, derived revenue
                  </th>
                  <th className="p-2 font-medium min-w-48">
                    Monthly phasing ({fy})
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const b = budgetByProduct[p.productId];
                  const annRev =
                    b != null
                      ? (
                          Number.parseFloat(b.annualQtyKg) *
                          Number.parseFloat(b.budgetUnitPricePerKg)
                        ).toFixed(2)
                      : "—";
                  const rowPcts =
                    profilePctsByProduct[p.productId] ??
                    Array.from({ length: 12 }, () => "0");
                  return (
                    <tr
                      key={p.productId}
                      className="border-b border-border align-top"
                    >
                      <td className="p-2">
                        <div className="font-medium">{p.productName}</div>
                        {p.productCode ? (
                          <div className="text-xs opacity-60 font-mono">
                            {p.productCode}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap items-end gap-2">
                          <form
                            className="flex flex-wrap items-end gap-2"
                            action={async (formData) => {
                              try {
                                setError(null);
                                setMessage(null);
                                await upsertProductSalesBudget(formData);
                                flashOk(`Budget saved for ${p.productName}.`);
                                router.refresh();
                              } catch (e) {
                                flashError(e);
                              }
                            }}
                          >
                            <input
                              type="hidden"
                              name="financialYear"
                              value={fy}
                            />
                            <input
                              type="hidden"
                              name="productId"
                              value={p.productId}
                            />
                            <input
                              name="annualQtyKg"
                              type="text"
                              inputMode="decimal"
                              required
                              defaultValue={b?.annualQtyKg ?? ""}
                              placeholder="Qty kg"
                              aria-label={`Annual qty kg for ${p.productName}`}
                              className="w-28 rounded-md border border-border bg-transparent px-2 py-1.5 tabular-nums"
                            />
                            <input
                              name="budgetUnitPricePerKg"
                              type="text"
                              inputMode="decimal"
                              required
                              defaultValue={b?.budgetUnitPricePerKg ?? ""}
                              placeholder="XAF/kg"
                              aria-label={`Budget XAF per kg for ${p.productName}`}
                              className="w-28 rounded-md border border-border bg-transparent px-2 py-1.5 tabular-nums"
                            />
                            <span className="text-xs tabular-nums opacity-80 py-1.5 whitespace-nowrap">
                              {b ? `→ ${annRev} XAF` : "—"}
                            </span>
                            <button
                              type="submit"
                              className="rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent/25"
                            >
                              Save
                            </button>
                          </form>
                          {b ? (
                            <form
                              action={async (formData) => {
                                try {
                                  setError(null);
                                  setMessage(null);
                                  await deleteProductSalesBudget(formData);
                                  flashOk(
                                    `Cleared budget for ${p.productName}.`,
                                  );
                                  router.refresh();
                                } catch (e) {
                                  flashError(e);
                                }
                              }}
                            >
                              <input
                                type="hidden"
                                name="financialYear"
                                value={fy}
                              />
                              <input
                                type="hidden"
                                name="productId"
                                value={p.productId}
                              />
                              <button
                                type="submit"
                                className="text-xs underline underline-offset-2 text-red-600 dark:text-red-400 py-1.5"
                              >
                                Clear
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-2">
                        <details className="rounded-lg border border-border bg-transparent">
                          <summary className="cursor-pointer px-2 py-1.5 text-xs font-medium hover:bg-accent/25">
                            FY months 1–12 (%)
                          </summary>
                          <div className="border-t border-border p-2 space-y-2">
                            <p className="text-[11px] opacity-75 leading-snug">
                              Twelve percentages must sum to 100%. Months outside
                              this financial year’s calendar bounds are ignored
                              and remaining weights are renormalized.
                            </p>
                            <ProductPhasePctEditor
                              financialYear={fy}
                              productId={p.productId}
                              fiscalMonthLabels={fiscalMonthLabels}
                              serverPctKey={rowPcts.join("|")}
                              initialPcts={rowPcts}
                              onAfterSave={() => {
                                setError(null);
                                setMessage(null);
                                flashOk(
                                  `Phasing saved for ${p.productName} (${fy}).`,
                                );
                                router.refresh();
                              }}
                              onAfterSaveError={(e) => {
                                flashError(e);
                              }}
                            />
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {fy != null ? (
        <section className="space-y-3 rounded-xl border border-border p-4">
          <h2 className="text-lg font-medium">Phasing preview</h2>
          <p className="text-xs opacity-75">
            Uses the saved monthly profile for the selected product and financial
            year. Enter values and run preview (does not save the product row).
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="grid gap-1">
              <label className="text-xs font-medium" htmlFor="previewProduct">
                Product
              </label>
              <select
                id="previewProduct"
                className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm min-w-48"
                value={products.length === 0 ? "" : previewProductId}
                onChange={(e) => setPreviewProductId(e.target.value)}
                disabled={products.length === 0}
              >
                {products.length === 0 ? (
                  <option value="">No products defined</option>
                ) : (
                  products.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.productName}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium" htmlFor="previewQty">
                Annual qty (kg)
              </label>
              <input
                id="previewQty"
                type="text"
                inputMode="decimal"
                value={previewQty}
                onChange={(e) => setPreviewQty(e.target.value)}
                className="w-28 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm tabular-nums"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium" htmlFor="previewPrice">
                XAF/kg
              </label>
              <input
                id="previewPrice"
                type="text"
                inputMode="decimal"
                value={previewPrice}
                onChange={(e) => setPreviewPrice(e.target.value)}
                className="w-28 rounded-md border border-border bg-transparent px-2 py-1.5 text-sm tabular-nums"
              />
            </div>
            <button
              type="button"
              disabled={previewBusy || products.length === 0}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/25 disabled:opacity-50"
              onClick={async () => {
                try {
                  setPreviewBusy(true);
                  setError(null);
                  const fd = new FormData();
                  fd.set("financialYear", String(fy));
                  fd.set("productId", previewProductId);
                  fd.set("annualQtyKg", previewQty);
                  fd.set("budgetUnitPricePerKg", previewPrice);
                  const r = await previewSalesBudgetPhaseAction(fd);
                  setPreview(r);
                } catch (e) {
                  flashError(e);
                  setPreview(null);
                } finally {
                  setPreviewBusy(false);
                }
              }}
            >
              {previewBusy ? "Running…" : "Run preview"}
            </button>
          </div>

          {preview ? (
            <div className="space-y-4 mt-4 text-sm">
              <div className="flex flex-wrap gap-4 text-xs opacity-90 tabular-nums">
                <span>
                  Annual qty: {formatPhasedQtyKgDisplay(preview.annualQtyKg)} kg
                </span>
                <span>Price: {preview.budgetUnitPricePerKg} XAF/kg</span>
                <span>
                  Phased annual revenue:{" "}
                  {formatPhasedRevenueDisplay(preview.annualRevenue)} XAF
                </span>
              </div>
              <div className="space-y-2">
                {preview.months.map((m) => (
                  <details
                    key={`${m.financialMonth}-${m.calendarYear}-${m.calendarMonth}`}
                    className="rounded-lg border border-border"
                  >
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-accent/25">
                      FY mo {m.financialMonth} · {m.calendarLabel} ·{" "}
                      {formatPhasedQtyKgDisplay(m.monthlyQtyKg)} kg ·{" "}
                      {formatPhasedRevenueDisplay(m.monthlyRevenue)} XAF
                    </summary>
                    <div className="border-t border-border p-3 space-y-3">
                      <details className="text-xs">
                        <summary className="cursor-pointer opacity-80">
                          Daily breakdown
                        </summary>
                        <div className="mt-2 max-h-48 overflow-auto rounded border border-border">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border text-left">
                                <th className="p-1">Date</th>
                                <th className="p-1">ISO week</th>
                                <th className="p-1">Qty (kg)</th>
                                <th className="p-1">XAF</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.days.map((d0) => (
                                <tr
                                  key={d0.isoDate}
                                  className="border-b border-border"
                                >
                                  <td className="p-1 font-mono">
                                    {d0.isoDate}
                                  </td>
                                  <td className="p-1 tabular-nums">
                                    {d0.isoWeekYear}-W
                                    {String(d0.isoWeek).padStart(2, "0")}
                                  </td>
                                  <td className="p-1 tabular-nums">
                                    {formatPhasedQtyKgDisplay(d0.qtyKg)}
                                  </td>
                                  <td className="p-1 tabular-nums">
                                    {formatPhasedRevenueDisplay(d0.revenue)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                      <details className="text-xs">
                        <summary className="cursor-pointer opacity-80">
                          ISO week rollup
                        </summary>
                        <ul className="mt-2 space-y-1 font-mono tabular-nums">
                          {m.weeks.map((w) => (
                            <li key={w.label}>
                              {w.label}: {formatPhasedQtyKgDisplay(w.qtyKg)} kg ·{" "}
                              {formatPhasedRevenueDisplay(w.revenue)} XAF
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
