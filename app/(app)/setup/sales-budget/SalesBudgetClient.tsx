"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { formatFinancialYearLabel, monthName } from "@/lib/fiscal";
import type { SalesBudgetPhaseResult } from "@/lib/sales-budget-phase";
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

export function SalesBudgetClient(props: {
  periods: PeriodRow[];
  selectedFinancialYear: number | null;
  fiscalYearStartMonth: number;
  fiscalMonthLabels: { financialMonth: number; label: string }[];
  profilePcts: string[];
  products: ProductRow[];
  budgetByProduct: Record<number, { annualQtyKg: string; budgetUnitPricePerKg: string }>;
}) {
  const {
    periods,
    selectedFinancialYear,
    fiscalYearStartMonth,
    fiscalMonthLabels,
    profilePcts,
    products,
    budgetByProduct,
  } = props;

  const router = useRouter();
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<SalesBudgetPhaseResult | null>(null);
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
        <h1 className="text-2xl font-semibold">Sales budgets</h1>
        <p className="text-sm opacity-75 max-w-3xl">
          Set annual quantity (kg) and budgeted unit price per kg per product for each financial year.
          Quantities are phased into fiscal months using the percentage profile below, then spread evenly
          across each calendar day. Revenue follows phased quantity × price at each level (XAF, 2 dp).
        </p>
      </div>

      {periods.length === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          No financial years exist yet. Add one under Financial years before entering budgets.
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
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm min-w-56"
              value={fy}
              onChange={(e) => {
                const v = e.target.value;
                router.push(`/setup/sales-budget?fy=${encodeURIComponent(v)}`);
                router.refresh();
              }}
            >
              {periods.map((p) => (
                <option key={p.financialYear} value={p.financialYear}>
                  {formatFinancialYearLabel(p.financialYear, fiscalYearStartMonth)} ({p.status})
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs opacity-70">
            Fiscal start:{" "}
            <span className="font-medium">{monthName(fiscalYearStartMonth)}</span>
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

      <section className="space-y-3 rounded-xl border border-black/10 dark:border-white/10 p-4">
        <h2 className="text-lg font-medium">Monthly phase profile</h2>
        <p className="text-xs opacity-75">
          Twelve percentages for fiscal months 1–12 must sum to 100%. Months outside the selected
          financial year’s calendar bounds are ignored and remaining weights are renormalized.
        </p>
        <form
          className="space-y-3"
          action={async (formData) => {
            try {
              setError(null);
              setMessage(null);
              await saveSalesBudgetPhaseProfile(formData);
              flashOk("Phase profile saved.");
              router.refresh();
            } catch (e) {
              flashError(e);
            }
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fiscalMonthLabels.map((row, idx) => {
              const key = `pctM${String(row.financialMonth).padStart(2, "0")}`;
              return (
                <div key={row.financialMonth} className="grid gap-1">
                  <label className="text-xs font-medium" htmlFor={key}>
                    FY mo {row.financialMonth} · {row.label}
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id={key}
                      name={key}
                      type="text"
                      inputMode="decimal"
                      required
                      defaultValue={profilePcts[idx] ?? "0"}
                      className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm tabular-nums"
                    />
                    <span className="text-xs opacity-60">%</span>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="submit"
            className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            Save profile
          </button>
        </form>
      </section>

      {fy != null && products.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Annual budgets by product</h2>
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 text-left">
                  <th className="p-2 font-medium">Product</th>
                  <th className="p-2 font-medium">
                    Annual qty (kg), budget XAF/kg, derived revenue
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
                  return (
                    <tr
                      key={p.productId}
                      className="border-b border-black/5 dark:border-white/5 align-top"
                    >
                      <td className="p-2">
                        <div className="font-medium">{p.productName}</div>
                        {p.productCode ? (
                          <div className="text-xs opacity-60 font-mono">{p.productCode}</div>
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
                            <input type="hidden" name="financialYear" value={fy} />
                            <input type="hidden" name="productId" value={p.productId} />
                            <input
                              name="annualQtyKg"
                              type="text"
                              inputMode="decimal"
                              required
                              defaultValue={b?.annualQtyKg ?? ""}
                              placeholder="Qty kg"
                              aria-label={`Annual qty kg for ${p.productName}`}
                              className="w-28 rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 tabular-nums"
                            />
                            <input
                              name="budgetUnitPricePerKg"
                              type="text"
                              inputMode="decimal"
                              required
                              defaultValue={b?.budgetUnitPricePerKg ?? ""}
                              placeholder="XAF/kg"
                              aria-label={`Budget XAF per kg for ${p.productName}`}
                              className="w-28 rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 tabular-nums"
                            />
                            <span className="text-xs tabular-nums opacity-80 py-1.5 whitespace-nowrap">
                              {b ? `→ ${annRev} XAF` : "—"}
                            </span>
                            <button
                              type="submit"
                              className="rounded-md border border-black/10 dark:border-white/10 px-2 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
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
                                  flashOk(`Cleared budget for ${p.productName}.`);
                                  router.refresh();
                                } catch (e) {
                                  flashError(e);
                                }
                              }}
                            >
                              <input type="hidden" name="financialYear" value={fy} />
                              <input type="hidden" name="productId" value={p.productId} />
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {fy != null ? (
        <section className="space-y-3 rounded-xl border border-black/10 dark:border-white/10 p-4">
          <h2 className="text-lg font-medium">Phasing preview</h2>
          <p className="text-xs opacity-75">
            Uses the saved monthly profile and financial year dates. Enter values and run preview
            (does not save the product row).
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="grid gap-1">
              <label className="text-xs font-medium" htmlFor="previewProduct">
                Product
              </label>
              <select
                id="previewProduct"
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm min-w-48"
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
                className="w-28 rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm tabular-nums"
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
                className="w-28 rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm tabular-nums"
              />
            </div>
            <button
              type="button"
              disabled={previewBusy || products.length === 0}
              className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
              onClick={async () => {
                try {
                  setPreviewBusy(true);
                  setError(null);
                  const fd = new FormData();
                  fd.set("financialYear", String(fy));
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
                <span>Annual qty: {preview.annualQtyKg} kg</span>
                <span>Price: {preview.budgetUnitPricePerKg} XAF/kg</span>
                <span>Phased annual revenue: {preview.annualRevenue} XAF</span>
              </div>
              <div className="space-y-2">
                {preview.months.map((m) => (
                  <details
                    key={`${m.financialMonth}-${m.calendarYear}-${m.calendarMonth}`}
                    className="rounded-lg border border-black/10 dark:border-white/10"
                  >
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5">
                      FY mo {m.financialMonth} · {m.calendarLabel} · {m.monthlyQtyKg} kg ·{" "}
                      {m.monthlyRevenue} XAF
                    </summary>
                    <div className="border-t border-black/10 dark:border-white/10 p-3 space-y-3">
                      <details className="text-xs">
                        <summary className="cursor-pointer opacity-80">Daily breakdown</summary>
                        <div className="mt-2 max-h-48 overflow-auto rounded border border-black/5 dark:border-white/5">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-black/10 dark:border-white/10 text-left">
                                <th className="p-1">Date</th>
                                <th className="p-1">ISO week</th>
                                <th className="p-1">Qty (kg)</th>
                                <th className="p-1">XAF</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.days.map((d0) => (
                                <tr key={d0.isoDate} className="border-b border-black/5 dark:border-white/5">
                                  <td className="p-1 font-mono">{d0.isoDate}</td>
                                  <td className="p-1 tabular-nums">
                                    {d0.isoWeekYear}-W{String(d0.isoWeek).padStart(2, "0")}
                                  </td>
                                  <td className="p-1 tabular-nums">{d0.qtyKg}</td>
                                  <td className="p-1 tabular-nums">{d0.revenue}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                      <details className="text-xs">
                        <summary className="cursor-pointer opacity-80">ISO week rollup</summary>
                        <ul className="mt-2 space-y-1 font-mono tabular-nums">
                          {m.weeks.map((w) => (
                            <li key={w.label}>
                              {w.label}: {w.qtyKg} kg · {w.revenue} XAF
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
