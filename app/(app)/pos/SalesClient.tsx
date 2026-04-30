"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useWorkingPeriod, workingMonthDateBounds } from "@/contexts/WorkingPeriodContext";
import { utcIsoDateToday } from "@/lib/posting-calendar";
import { useAuth } from "@/contexts/AuthContext";
import { canValidateDocuments } from "@/lib/auth-roles";
import { UserRole, ValidationStatus } from "@prisma/client";
import type { DeliveryOrderLookupDto } from "@/lib/delivery-order-sale-control";
import type { LoadedSaleView, SaveSaleResult } from "./actions";

type Customer = {
  id: string;
  name: string;
  taxRegimeId: string;
  taxRegime: { name: string; vatApplies: boolean };
};

type Product = {
  productId: number;
  productName: string;
  productCat: { productCat: string };
};

type Line = { productId: string; qtyKg: string; unitPricePerKg: string };

type Payment = { method: "CASH" | "CHEQUE"; amount: string; chequeNo?: string };

function parseDec(s: string) {
  const n = Number.parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function SalesClient(props: {
  customers: Customer[];
  products: Product[];
  salesPoints: Array<{ id: number; name: string }>;
  vatRateDecimal: string;
  saveSaleAction: (formData: FormData) => Promise<SaveSaleResult>;
  loadSaleByInvoiceNo: (invoiceNo: string) => Promise<LoadedSaleView | null>;
  lookupDeliveryOrderAction: (
    deliveryOrderNo: string,
    customerId: string,
  ) => Promise<
    | { ok: true; data: DeliveryOrderLookupDto & { customerMatches: boolean } }
    | { ok: false; error: string }
  >;
  validateSaleAction: (formData: FormData) => Promise<void> | void;
  deleteSaleAction: (formData: FormData) => Promise<void> | void;
}) {
  const {
    customers,
    products,
    salesPoints,
    vatRateDecimal,
    saveSaleAction,
    loadSaleByInvoiceNo,
    lookupDeliveryOrderAction,
    validateSaleAction,
    deleteSaleAction,
  } = props;

  const wp = useWorkingPeriod();
  const router = useRouter();
  const { status: authStatus, session } = useAuth();

  const [saleId, setSaleId] = React.useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = React.useState<string>("");
  const [lookupNo, setLookupNo] = React.useState<string>("");
  const [soldAtIso, setSoldAtIso] = React.useState<string>("");
  const [referenceNumber, setReferenceNumber] = React.useState<string>("");
  const [vehicleNumber, setVehicleNumber] = React.useState("");
  const [deliveryOrderNo, setDeliveryOrderNo] = React.useState("");
  const [doLookupData, setDoLookupData] = React.useState<
    (DeliveryOrderLookupDto & { customerMatches: boolean }) | null
  >(null);
  const [doLookupError, setDoLookupError] = React.useState<string | null>(null);
  const [doLookupBusy, setDoLookupBusy] = React.useState(false);
  const [salesPointId, setSalesPointId] = React.useState<string>("");
  const [saleStatus, setSaleStatus] = React.useState<ValidationStatus | null>(
    null,
  );
  const [validatedByName, setValidatedByName] = React.useState<string>("");
  const [validatedAtIso, setValidatedAtIso] = React.useState<string>("");

  const [customerId, setCustomerId] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>(() => [
    {
      productId: "",
      qtyKg: "0",
      unitPricePerKg: "0",
    },
  ]);
  const [payments, setPayments] = React.useState<Payment[]>(() => [
    { method: "CASH", amount: "0" },
  ]);
  const [transactionDate, setTransactionDate] = React.useState(utcIsoDateToday);

  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    invoiceNo: string;
  } | null>(null);

  React.useEffect(() => {
    if (session?.salesPoint?.id != null) {
      setSalesPointId(String(session.salesPoint.id));
    }
  }, [session?.salesPoint?.id]);

  React.useEffect(() => {
    if (wp.openFinancialYear == null) return;
    const { minIso, maxIso } = workingMonthDateBounds(
      wp.workingCalendarYear,
      wp.workingCalendarMonth,
    );
    setTransactionDate((prev) => {
      if (prev < minIso) return minIso;
      if (prev > maxIso) return maxIso;
      return prev;
    });
  }, [wp.openFinancialYear, wp.workingCalendarYear, wp.workingCalendarMonth]);

  React.useEffect(() => {
    const no = deliveryOrderNo.trim();
    if (!no) {
      setDoLookupData(null);
      setDoLookupError(null);
      setDoLookupBusy(false);
      return;
    }
    setDoLookupBusy(true);
    setDoLookupError(null);
    let alive = true;
    const t = window.setTimeout(() => {
      void lookupDeliveryOrderAction(no, customerId).then((r) => {
        if (!alive) return;
        if (r.ok) {
          setDoLookupData(r.data);
          setDoLookupError(null);
        } else {
          setDoLookupData(null);
          setDoLookupError(r.error);
        }
        setDoLookupBusy(false);
      });
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [deliveryOrderNo, customerId, lookupDeliveryOrderAction]);

  const customer = customers.find((c) => c.id === customerId);
  const vatApplicable = customer?.taxRegime.vatApplies ?? false;
  const vatRate = vatApplicable ? Number.parseFloat(vatRateDecimal) : 0;
  const net = lines.reduce(
    (sum, l) => sum + parseDec(l.qtyKg) * parseDec(l.unitPricePerKg),
    0,
  );
  const vat = Math.round(net * vatRate * 100) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  const paid = payments.reduce((sum, p) => sum + parseDec(p.amount), 0);

  const transactionDateBounds =
    wp.openFinancialYear != null
      ? workingMonthDateBounds(wp.workingCalendarYear, wp.workingCalendarMonth)
      : null;

  const deliveryOrderSaveBlock = React.useMemo(() => {
    const trimmed = deliveryOrderNo.trim();
    if (!trimmed) {
      return { block: false as boolean, hint: null as string | null };
    }
    if (doLookupBusy) {
      return { block: true, hint: "Checking delivery order…" };
    }
    if (doLookupError) {
      return { block: true, hint: doLookupError };
    }
    if (!doLookupData) {
      return { block: true, hint: "Loading delivery order…" };
    }
    if (customerId && !doLookupData.customerMatches) {
      return {
        block: true,
        hint: "Selected customer must match the delivery order customer.",
      };
    }
    const saleQtyByProduct = new Map<number, number>();
    for (const l of lines) {
      const pid = Number.parseInt(l.productId, 10);
      if (!l.productId || !Number.isFinite(pid)) continue;
      const qty = parseDec(l.qtyKg);
      if (qty <= 0) continue;
      saleQtyByProduct.set(pid, (saleQtyByProduct.get(pid) ?? 0) + qty);
    }
    for (const [pid, saleQty] of saleQtyByProduct) {
      const row = doLookupData.perProduct.find((p) => p.productId === pid);
      if (!row) {
        return {
          block: true,
          hint: "Every invoiced product must appear on the delivery order.",
        };
      }
      if (saleQty > parseDec(row.balanceKg) + 1e-9) {
        return {
          block: true,
          hint: `Total qty for ${row.productName} on this invoice (${saleQty}) exceeds remaining balance (${row.balanceKg} kg).`,
        };
      }
    }
    return { block: false, hint: null };
  }, [
    deliveryOrderNo,
    doLookupBusy,
    doLookupError,
    doLookupData,
    customerId,
    lines,
  ]);

  function resetNew() {
    setSaleId(null);
    setInvoiceNo("");
    setLookupNo("");
    setSoldAtIso("");
    setReferenceNumber("");
    setVehicleNumber("");
    setDeliveryOrderNo("");
    setDoLookupData(null);
    setDoLookupError(null);
    setDoLookupBusy(false);
    setSalesPointId(session?.salesPoint ? String(session.salesPoint.id) : "");
    setSaleStatus(null);
    setValidatedByName("");
    setValidatedAtIso("");
    setCustomerId("");
    setLines([
      {
        productId: "",
        qtyKg: "0",
        unitPricePerKg: "0",
      },
    ]);
    setPayments([{ method: "CASH", amount: "0" }]);
    setTransactionDate(utcIsoDateToday());
    setBanner(null);
  }

  function applyLoaded(s: LoadedSaleView) {
    setSaleId(s.id);
    setInvoiceNo(s.invoiceNo);
    setLookupNo(s.invoiceNo);
    setSoldAtIso(s.soldAtIso);
    setTransactionDate(
      (s.dateIssuedIso ? s.dateIssuedIso.slice(0, 10) : s.soldAtIso.slice(0, 10)) ||
        utcIsoDateToday(),
    );
    setReferenceNumber(s.referenceNumber ?? "");
    setVehicleNumber(s.vehicleNumber ?? "");
    setDeliveryOrderNo(s.deliveryOrderNo ?? "");
    setSalesPointId(s.salesPointId != null ? String(s.salesPointId) : "");
    setSaleStatus(s.status);
    setValidatedByName(s.validatedByName ?? "");
    setValidatedAtIso(s.validatedAtIso ?? "");
    setCustomerId(s.customerId);
    setLines(
      s.lines.length > 0
        ? s.lines.map((l) => ({
            productId: String(l.productId),
            qtyKg: l.qtyKg,
            unitPricePerKg: l.unitPricePerKg,
          }))
        : [
            {
              productId: "",
              qtyKg: "0",
              unitPricePerKg: "0",
            },
          ],
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
        setBanner({
          type: "error",
          text: "No sale matches that invoice number.",
        });
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
      if (authStatus !== "ready" || !session?.userId) {
        setBanner({ type: "error", text: "Login required." });
        return;
      }
      if (lines.some((l) => !String(l.productId ?? "").trim())) {
        setBanner({
          type: "error",
          text: "Select a product on every line.",
        });
        return;
      }
      if (!vehicleNumber.trim()) {
        setBanner({ type: "error", text: "Vehicle number is required." });
        return;
      }
      if (deliveryOrderSaveBlock.block) {
        setBanner({
          type: "error",
          text:
            deliveryOrderSaveBlock.hint ??
            "Fix delivery order details before saving.",
        });
        return;
      }
      const fd = new FormData();
      fd.set("customerId", customerId);
      fd.set("createdByUserId", session.userId);
      fd.set("referenceNumber", referenceNumber);
      fd.set("vehicleNumber", vehicleNumber);
      fd.set("deliveryOrderNo", deliveryOrderNo.trim());
      fd.set(
        "salesPointId",
        session?.salesPoint?.id != null
          ? String(session.salesPoint.id)
          : salesPointId,
      );
      fd.set("lines", JSON.stringify(lines));
      fd.set("payments", JSON.stringify(payments));
      fd.set(
        "postingFinancialYear",
        wp.openFinancialYear != null ? String(wp.openFinancialYear) : "",
      );
      fd.set("postingCalendarYear", String(wp.workingCalendarYear));
      fd.set("postingCalendarMonth", String(wp.workingCalendarMonth));
      fd.set("transactionDate", transactionDate);

      const r = await saveSaleAction(fd);
      if (r.ok) {
        setSaleId(r.id);
        setInvoiceNo(r.invoiceNo);
        setLookupNo(r.invoiceNo);
        setSoldAtIso(r.soldAtIso);
        setSaleStatus(ValidationStatus.PENDING);
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

  async function onValidate() {
    if (!saleId) return;
    if (authStatus !== "ready" || !session?.userId) {
      setBanner({ type: "error", text: "Login required." });
      return;
    }
    setBusy("validate");
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("id", saleId);
      fd.set("validatorUserId", session.userId);
      fd.set("validatorRole", session.role);
      await validateSaleAction(fd);
      setBanner({ type: "ok", text: "Invoice validated." });
      router.refresh();
    } catch (e) {
      setBanner({
        type: "error",
        text: e instanceof Error ? e.message : "Could not validate.",
      });
    } finally {
      setBusy(null);
    }
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
        <p className="text-xs opacity-75">
          Enter the invoice number (e.g. PO-2026-000001) to load it.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="grid gap-1 flex-1">
            <label className="text-xs font-medium opacity-70">
              Invoice no.
            </label>
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
              Posting period:{" "}
              <span className="font-medium tabular-nums">FY {wp.fyLabel}</span>{" "}
              · <span className="font-medium">{wp.workingMonthLabel}</span>
            </p>
            <p className="text-xs opacity-75 mt-1">
              <span className="opacity-70">Sold at</span>{" "}
              <span className="font-medium tabular-nums">
                {soldAtIso
                  ? new Date(soldAtIso)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")
                  : "—"}
              </span>
            </p>
            <p className="text-xs opacity-75 mt-1">
              <span className="opacity-70">Status</span>{" "}
              <span className="font-medium">{saleStatus ?? "—"}</span>
              {saleStatus === ValidationStatus.VALIDATED ? (
                <span className="opacity-70">
                  {" "}
                  · Validated by{" "}
                  <span className="font-medium">{validatedByName || "—"}</span>
                  {validatedAtIso ? (
                    <span className="opacity-70">
                      {" "}
                      (
                      {new Date(validatedAtIso)
                        .toISOString()
                        .slice(0, 16)
                        .replace("T", " ")}
                      )
                    </span>
                  ) : null}
                </span>
              ) : null}
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
              className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={saleId != null}
              required
            >
              <option value="" disabled>
                Select Customer
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="text-xs opacity-70">
              VAT: {vatApplicable ? "applies" : "exempt"} · Regime:{" "}
              {customer?.taxRegime.name ?? "-"}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Reference no. (optional)
            </label>
            <input
              className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Voucher / customer ref"
              disabled={saleId != null}
            />
            <div className="text-xs opacity-70 min-h-4">
              Printed as reference number.
            </div>
          </div>

          <div className="grid gap-2 sm:col-start-1">
            <label className="text-sm font-medium">Sales point</label>
            {session?.salesPoint ? (
              <>
                <input
                  className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                  value={session.salesPoint.name}
                  readOnly
                />
                <div className="text-xs opacity-70">
                  This comes from your login session and cannot be changed here.
                </div>
              </>
            ) : (
              <>
                <select
                  className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  value={salesPointId}
                  onChange={(e) => setSalesPointId(e.target.value)}
                  disabled={saleId != null}
                >
                  <option value="">select Sales Point</option>
                  {salesPoints.map((sp) => (
                    <option key={sp.id} value={String(sp.id)}>
                      {sp.name}
                    </option>
                  ))}
                </select>
                <div className="text-xs opacity-70">
                  Optional for manager/admin sessions without a fixed sales point.
                </div>
              </>
            )}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <label className="text-sm font-medium">Sale date</label>
            <input
              type="date"
              className="w-full max-w-xs rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              value={transactionDate}
              min={transactionDateBounds?.minIso}
              max={transactionDateBounds?.maxIso}
              onChange={(e) => setTransactionDate(e.target.value)}
              disabled={saleId != null || wp.openFinancialYear == null}
              required
            />
            <p className="text-xs opacity-70">
              Must fall within your working calendar month (
              {transactionDateBounds
                ? `${transactionDateBounds.minIso}–${transactionDateBounds.maxIso}`
                : "—"}
              ).
            </p>
          </div>

          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Vehicle number</label>
              <input
                className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="Registration / fleet id"
                disabled={saleId != null}
                required
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                Delivery order no.{" "}
                <span className="font-normal opacity-70">(optional)</span>
              </label>
              <input
                className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                value={deliveryOrderNo}
                onChange={(e) => setDeliveryOrderNo(e.target.value)}
                placeholder="Link to delivery order for qty control"
                disabled={saleId != null}
              />
            </div>
          </div>

          {deliveryOrderNo.trim() ? (
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm space-y-2 sm:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
                Delivery order control
              </div>
              {doLookupBusy ? (
                <p className="text-xs opacity-70">Loading delivery order…</p>
              ) : null}
              {doLookupError ? (
                <p className="text-xs text-red-700 dark:text-red-400">
                  {doLookupError}
                </p>
              ) : null}
              {doLookupData ? (
                <>
                  <div className="grid gap-1 text-xs sm:text-sm">
                    <p>
                      <span className="opacity-70">Date issued</span>{" "}
                      <span className="font-medium tabular-nums">
                        {new Date(doLookupData.dateIssuedIso)
                          .toISOString()
                          .slice(0, 10)}
                      </span>
                    </p>
                    <p>
                      <span className="opacity-70">Customer on D.O.</span>{" "}
                      <span className="font-medium">{doLookupData.customerName}</span>
                    </p>
                    <p>
                      <span className="opacity-70">Ordered (total)</span>{" "}
                      <span className="font-medium tabular-nums">
                        {doLookupData.totalOrderedKg} kg
                      </span>
                      {" · "}
                      <span className="opacity-70">Already invoiced</span>{" "}
                      <span className="font-medium tabular-nums">
                        {doLookupData.totalInvoicedKg} kg
                      </span>
                      {" · "}
                      <span className="opacity-70">Balance</span>{" "}
                      <span className="font-medium tabular-nums">
                        {doLookupData.totalBalanceKg} kg
                      </span>
                    </p>
                    {customerId && !doLookupData.customerMatches ? (
                      <p className="text-amber-800 dark:text-amber-300 text-xs">
                        Warning: selected customer does not match this delivery
                        order. Saving will be blocked until they match.
                      </p>
                    ) : null}
                  </div>
                  {doLookupData.perProduct.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse min-w-[320px]">
                        <thead>
                          <tr className="border-b border-black/15 dark:border-white/15">
                            <th className="text-left py-1.5 pr-2 font-medium">
                              Product
                            </th>
                            <th className="text-right py-1.5 px-1 font-medium tabular-nums">
                              Ordered
                            </th>
                            <th className="text-right py-1.5 px-1 font-medium tabular-nums">
                              Invoiced
                            </th>
                            <th className="text-right py-1.5 pl-2 font-medium tabular-nums">
                              Balance
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {doLookupData.perProduct.map((r) => (
                            <tr
                              key={r.productId}
                              className="border-b border-black/10 dark:border-white/10"
                            >
                              <td className="py-1.5 pr-2">{r.productName}</td>
                              <td className="text-right tabular-nums py-1.5 px-1">
                                {r.orderedKg}
                              </td>
                              <td className="text-right tabular-nums py-1.5 px-1">
                                {r.invoicedKg}
                              </td>
                              <td className="text-right tabular-nums py-1.5 pl-2">
                                {r.balanceKg}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <section
          className={`space-y-2 ${saleId != null ? "opacity-60 pointer-events-none" : ""}`}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Items</h3>
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    productId: "",
                    qtyKg: "0",
                    unitPricePerKg: "0",
                  },
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
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
              >
                <div className="col-span-5">
                  <select
                    className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                    value={l.productId}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, productId: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    <option value="" disabled>
                      Select Product
                    </option>
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
                        prev.map((x, i) =>
                          i === idx ? { ...x, qtyKg: e.target.value } : x,
                        ),
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
                          i === idx
                            ? { ...x, unitPricePerKg: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    className="text-xs underline underline-offset-4 opacity-80"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== idx))
                    }
                    disabled={lines.length === 1}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section
          className={`space-y-2 ${saleId != null ? "opacity-60 pointer-events-none" : ""}`}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Payments</h3>
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() =>
                setPayments((prev) => [
                  ...prev,
                  { method: "CASH", amount: "0" },
                ])
              }
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
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
              >
                <div className="col-span-4">
                  <select
                    className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                    value={p.method}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                method: e.target.value as Payment["method"],
                              }
                            : x,
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
                        prev.map((x, i) =>
                          i === idx ? { ...x, amount: e.target.value } : x,
                        ),
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
                        prev.map((x, i) =>
                          i === idx ? { ...x, chequeNo: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    className="text-xs underline underline-offset-4 opacity-80"
                    onClick={() =>
                      setPayments((prev) => prev.filter((_, i) => i !== idx))
                    }
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
          <div className="text-xs opacity-70 mt-2">
            Payments total: {paid.toFixed(2)} (must equal gross).
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {saleId == null &&
          (deliveryOrderSaveBlock.block || !vehicleNumber.trim()) ? (
            <p className="text-xs text-amber-800 dark:text-amber-300 max-w-xl">
              {!vehicleNumber.trim()
                ? "Enter a vehicle number before saving."
                : (deliveryOrderSaveBlock.hint ??
                  "Fix delivery order validation before saving.")}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={
              busy !== null ||
              saleId != null ||
              !vehicleNumber.trim() ||
              deliveryOrderSaveBlock.block
            }
            onClick={() => void onSaveSale()}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy === "save"
              ? "Saving…"
              : saleId != null
                ? "Loaded (read-only)"
                : "Save sale (create invoice)"}
          </button>
          {saleId && saleStatus === ValidationStatus.PENDING && session ? (
            canValidateDocuments(session.role) ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void onValidate()}
                className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
              >
                {busy === "validate" ? "Validating…" : "Validate invoice"}
              </button>
            ) : null
          ) : null}
          {saleId ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                setPendingDelete({
                  id: saleId,
                  invoiceNo: invoiceNo || `ID ${saleId}`,
                })
              }
              className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-600/10 disabled:opacity-50"
            >
              Delete invoice
            </button>
          ) : null}
          </div>
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
