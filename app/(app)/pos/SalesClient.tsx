"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useWorkingPeriod } from "@/contexts/WorkingPeriodContext";
import type { LoadedSaleView, SaveSaleResult } from "./actions";

type Customer = {
  id: string;
  name: string;
  taxRegimeId: string;
  taxRegime: { name: string; vatApplies: boolean };
};

type Product = { productId: number; productName: string; productCat: { productCat: string } };

type User = { id: string; name: string; role: string };

type Line = { productId: string; qtyKg: string; unitPricePerKg: string };

type Payment = { method: "CASH" | "CHEQUE"; amount: string; chequeNo?: string };

function parseDec(s: string) {
  const n = Number.parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function SalesClient(props: {
  customers: Customer[];
  products: Product[];
  users: User[];
  vatRateDecimal: string;
  saveSaleAction: (formData: FormData) => Promise<SaveSaleResult>;
  loadSaleByInvoiceNo: (invoiceNo: string) => Promise<LoadedSaleView | null>;
  deleteSaleAction: (formData: FormData) => Promise<void> | void;
}) {
  const { customers, products, users, vatRateDecimal, saveSaleAction, loadSaleByInvoiceNo, deleteSaleAction } =
    props;

  const wp = useWorkingPeriod();
  const router = useRouter();

  const [saleId, setSaleId] = React.useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = React.useState<string>("");
  const [lookupNo, setLookupNo] = React.useState<string>("");
  const [soldAtIso, setSoldAtIso] = React.useState<string>("");

  const [customerId, setCustomerId] = React.useState(customers[0]?.id ?? "");
  const [cashierId, setCashierId] = React.useState(users[0]?.id ?? "");
  const [lines, setLines] = React.useState<Line[]>(() => [
    { productId: String(products[0]?.productId ?? ""), qtyKg: "1", unitPricePerKg: "0" },
  ]);
  const [payments, setPayments] = React.useState<Payment[]>(() => [{ method: "CASH", amount: "0" }]);

  const [banner, setBanner] = React.useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{ id: string; invoiceNo: string } | null>(null);

  const customer = customers.find((c) => c.id === customerId);
  const vatApplicable = customer?.taxRegime.vatApplies ?? false;
  const vatRate = vatApplicable ? Number.parseFloat(vatRateDecimal) : 0;
  const net = lines.reduce((sum, l) => sum + parseDec(l.qtyKg) * parseDec(l.unitPricePerKg), 0);
  const vat = Math.round(net * vatRate * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  const paid = payments.reduce((sum, p) => sum + parseDec(p.amount), 0);

  function resetNew() {
    setSaleId(null);
    setInvoiceNo("");
    setLookupNo("");
    setSoldAtIso("");
    setCustomerId(customers[0]?.id ?? "");
    setCashierId(users[0]?.id ?? "");
    setLines([{ productId: String(products[0]?.productId ?? ""), qtyKg: "1", unitPricePerKg: "0" }]);
    setPayments([{ method: "CASH", amount: "0" }]);
    setBanner(null);
  }

  function applyLoaded(s: LoadedSaleView) {
    setSaleId(s.id);
    setInvoiceNo(s.invoiceNo);
    setLookupNo(s.invoiceNo);
    setSoldAtIso(s.soldAtIso);
    setCustomerId(s.customerId);
    setCashierId(s.createdByUserId);
    setLines(
      s.lines.length > 0
        ? s.lines.map((l) => ({
            productId: String(l.productId),
            qtyKg: l.qtyKg,
            unitPricePerKg: l.unitPricePerKg,
          }))
        : [{ productId: String(products[0]?.productId ?? ""), qtyKg: "1", unitPricePerKg: "0" }],
    );
    setPayments(
      s.payments.length > 0
        ? s.payments.map((p) => ({
            method: p.method === "CHEQUE" ? "CHEQUE" : "CASH",
            amount: p.amount,
            chequeNo: p.chequeNo ?? undefined,
          }))
        : [{ method: "CASH", amount: "0" }],
    );
    setBanner({ type: "ok", text: `Loaded ${s.invoiceNo}.` });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onLoadByNo() {
    setBusy("load");
    setBanner(null);
    try {
      const data = await loadSaleByInvoiceNo(lookupNo);
      if (!data) {
        setBanner({ type: "error", text: "No sale matches that invoice number." });
        return;
      }
      applyLoaded(data);
    } finally {
      setBusy(null);
    }
  }

  async function onSaveSale() {
    setBusy("save");
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("customerId", customerId);
      fd.set("createdByUserId", cashierId);
      fd.set("lines", JSON.stringify(lines));
      fd.set("payments", JSON.stringify(payments));
      fd.set("postingFinancialYear", wp.openFinancialYear != null ? String(wp.openFinancialYear) : "");
      fd.set("postingFinancialMonth", wp.openFinancialYear != null ? String(wp.workingMonth) : "");

      const r = await saveSaleAction(fd);
      if (r.ok) {
        setSaleId(r.id);
        setInvoiceNo(r.invoiceNo);
        setLookupNo(r.invoiceNo);
        setSoldAtIso(r.soldAtIso);
        setBanner({ type: "ok", text: `Created ${r.invoiceNo}.` });
        router.refresh();
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteConfirmed() {
    if (!saleId) return;
    const fd = new FormData();
    fd.set("id", saleId);
    await deleteSaleAction(fd);
    resetNew();
    setBanner({ type: "ok", text: "Sale deleted." });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {banner ? (
        <div
          className={
            banner.type === "error"
              ? "rounded-lg border border-red-600/40 bg-red-600/5 px-4 py-3 text-sm text-red-800 dark:text-red-300"
              : "rounded-lg border border-emerald-600/40 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-5 space-y-3">
        <div className="text-sm font-semibold">Open existing invoice</div>
        <p className="text-xs opacity-75">Enter the invoice number (e.g. PO-2026-000001) to load it.</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="grid gap-1 flex-1">
            <label className="text-xs font-medium opacity-70">Invoice no.</label>
            <input
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
              value={lookupNo}
              onChange={(e) => setLookupNo(e.target.value)}
              placeholder="PO-2026-000001"
            />
          </div>
          <button
            type="button"
            disabled={busy !== null || !lookupNo.trim()}
            onClick={() => void onLoadByNo()}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy === "load" ? "Loading…" : "Load invoice"}
          </button>
          <button
            type="button"
            onClick={resetNew}
            className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            New sale
          </button>
          {saleId ? (
            <Link
              href={`/sales/${saleId}`}
              className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm text-center hover:bg-black/5 dark:hover:bg-white/5"
            >
              View / print
            </Link>
          ) : null}
        </div>
      </div>

      <section className="rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Sale (invoice)</h2>
            <p className="text-xs opacity-75 mt-1">
              Posting period: <span className="font-medium tabular-nums">FY {wp.fyLabel}</span> ·{" "}
              <span className="font-medium">{wp.workingMonthLabel}</span>
            </p>
            <p className="text-xs opacity-75 mt-1">
              <span className="opacity-70">Sold at</span>{" "}
              <span className="font-medium tabular-nums">
                {soldAtIso ? new Date(soldAtIso).toISOString().slice(0, 16).replace("T", " ") : "—"}
              </span>
            </p>
          </div>
          {invoiceNo ? (
            <div className="text-sm">
              <span className="opacity-70">Invoice</span>{" "}
              <span className="font-semibold tabular-nums">{invoiceNo}</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Customer</label>
            <select
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={saleId != null}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="text-xs opacity-70">
              VAT: {vatApplicable ? "applies" : "exempt"} · Regime: {customer?.taxRegime.name ?? "-"}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Cashier</label>
            <select
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              value={cashierId}
              onChange={(e) => setCashierId(e.target.value)}
              disabled={saleId != null}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
            <div className="text-xs opacity-70 min-h-4">&nbsp;</div>
          </div>
        </div>

        <section className={`space-y-2 ${saleId != null ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Items</h3>
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  { productId: String(products[0]?.productId ?? ""), qtyKg: "1", unitPricePerKg: "0" },
                ])
              }
            >
              Add line
            </button>
          </div>

          <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
              <div className="col-span-5">Product</div>
              <div className="col-span-3">Qty (kg)</div>
              <div className="col-span-3">Price / kg</div>
              <div className="col-span-1" />
            </div>
            {lines.map((l, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                <div className="col-span-5">
                  <select
                    className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                    value={l.productId}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)),
                      )
                    }
                  >
                    {products.map((g) => (
                      <option key={g.productId} value={String(g.productId)}>
                        {g.productName} ({g.productCat.productCat})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input
                    className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                    value={l.qtyKg}
                    inputMode="decimal"
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, qtyKg: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="col-span-3">
                  <input
                    className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                    value={l.unitPricePerKg}
                    inputMode="decimal"
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, unitPricePerKg: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    className="text-xs underline underline-offset-4 opacity-80"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={lines.length === 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={`space-y-2 ${saleId != null ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Payments</h3>
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() => setPayments((prev) => [...prev, { method: "CASH", amount: "0" }])}
            >
              Add payment line
            </button>
          </div>

          <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
              <div className="col-span-4">Method</div>
              <div className="col-span-4">Amount</div>
              <div className="col-span-3">Cheque #</div>
              <div className="col-span-1" />
            </div>
            {payments.map((p, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                <div className="col-span-4">
                  <select
                    className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                    value={p.method}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, method: e.target.value as Payment["method"] } : x,
                        ),
                      )
                    }
                  >
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div className="col-span-4">
                  <input
                    className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                    value={p.amount}
                    inputMode="decimal"
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="col-span-3">
                  <input
                    className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                    value={p.chequeNo ?? ""}
                    placeholder={p.method === "CHEQUE" ? "Cheque number" : ""}
                    disabled={p.method !== "CHEQUE"}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, chequeNo: e.target.value } : x)),
                      )
                    }
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    className="text-xs underline underline-offset-4 opacity-80"
                    onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={payments.length === 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 text-sm">
          <div className="flex justify-between">
            <span className="opacity-70">Net</span>
            <span className="tabular-nums">{net.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">VAT</span>
            <span className="tabular-nums">{vat.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t border-black/10 dark:border-white/10 pt-2 mt-2">
            <span>Gross</span>
            <span className="tabular-nums">{gross.toFixed(2)}</span>
          </div>
          <div className="text-xs opacity-70 mt-2">Payments total: {paid.toFixed(2)} (must equal gross).</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy !== null || saleId != null}
            onClick={() => void onSaveSale()}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : saleId != null ? "Loaded (read-only)" : "Save sale (create invoice)"}
          </button>
          {saleId ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setPendingDelete({ id: saleId, invoiceNo: invoiceNo || `ID ${saleId}` })}
              className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-600/10 disabled:opacity-50"
            >
              Delete invoice
            </button>
          ) : null}
        </div>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this sale invoice?"
          description={`“${pendingDelete.invoiceNo}” will be removed permanently. Line items and payments will also be deleted. You cannot undo this action.`}
          confirmLabel="Delete invoice"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            setPendingDelete(null);
            await onDeleteConfirmed();
          }}
        />
      ) : null}
    </div>
  );
}

