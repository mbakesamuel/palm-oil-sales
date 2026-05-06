"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkingPeriod, workingMonthDateBounds } from "@/contexts/WorkingPeriodContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  canCreateOrEditDeliveryOrderDraft,
  canValidateDeliveryOrder,
} from "@/lib/auth-roles";
import { ValidationStatus } from "@/lib/domain";
import type {
  DeliveryOrderTaxPreview,
  LoadedDeliveryOrderView,
  SaveHeaderResult,
  SaveSectionResult,
} from "./actions";

type Customer = { id: string; name: string; vatApplies: boolean };
type Product = {
  productId: number;
  productName: string;
  productCat: { productCat: string };
};
type SalesPointOpt = { id: number; name: string };

type LineRow = {
  productId: string;
  orderQty: string;
  orderUnit: string;
  unitPrice: string;
};

type Payment = {
  method: "CASH" | "CHEQUE";
  paymentDate: string;
  chequeNo: string;
  bank: string;
  cashReceiptNo: string;
  receiptDate: string;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseDec(s: string) {
  const n = Number.parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function DeliveryOrdersClient(props: {
  customers: Customer[];
  products: Product[];
  salesPoints: SalesPointOpt[];
  previewDeliveryOrderTaxesAction: (
    customerId: string,
    dateIssuedIso: string,
  ) => Promise<
    { ok: true; preview: DeliveryOrderTaxPreview } | { ok: false; error: string }
  >;
  loadDeliveryOrderByNo: (
    no: string,
  ) => Promise<LoadedDeliveryOrderView | null>;
  saveDeliveryOrderHeader: (formData: FormData) => Promise<SaveHeaderResult>;
  saveDeliveryOrderDetails: (formData: FormData) => Promise<SaveSectionResult>;
  saveDeliveryOrderPayments: (formData: FormData) => Promise<SaveSectionResult>;
  deleteDeliveryOrder: (formData: FormData) => Promise<SaveSectionResult>;
  validateDeliveryOrder: (formData: FormData) => Promise<SaveSectionResult>;
}) {
  const {
    customers,
    products,
    salesPoints,
    previewDeliveryOrderTaxesAction,
    loadDeliveryOrderByNo,
    saveDeliveryOrderHeader,
    saveDeliveryOrderDetails,
    saveDeliveryOrderPayments,
    deleteDeliveryOrder,
    validateDeliveryOrder,
  } = props;

  const wp = useWorkingPeriod();
  const { status: authStatus, session } = useAuth();
  const router = useRouter();

  const [taxPreview, setTaxPreview] = React.useState<DeliveryOrderTaxPreview | null>(
    null,
  );
  const [taxPreviewError, setTaxPreviewError] = React.useState<string | null>(null);

  const [orderId, setOrderId] = React.useState<number | null>(null);
  const [deliveryOrderNo, setDeliveryOrderNo] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [dateIssued, setDateIssued] = React.useState(todayIsoDate);
  const [orderRef, setOrderRef] = React.useState("");
  const [salesPointId, setSalesPointId] = React.useState<string>("");
  const [lookupNo, setLookupNo] = React.useState("");
  const [docStatus, setDocStatus] = React.useState<ValidationStatus | null>(null);
  const [validatedByName, setValidatedByName] = React.useState("");
  const [validatedAtIso, setValidatedAtIso] = React.useState("");
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [lines, setLines] = React.useState<LineRow[]>(() =>
    products.length > 0
      ? [
          {
            productId: String(products[0].productId),
            orderQty: "1",
            orderUnit: "kg",
            unitPrice: "",
          },
        ]
      : [],
  );

  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: number;
    deliveryOrderNo: string;
  } | null>(null);

  function emptyLine(): LineRow {
    return {
      productId: String(products[0]?.productId ?? ""),
      orderQty: "1",
      orderUnit: "kg",
      unitPrice: "",
    };
  }

  React.useEffect(() => {
    if (!customerId || authStatus !== "ready" || !session?.userId?.trim()) {
      setTaxPreview(null);
      setTaxPreviewError(null);
      return;
    }
    let alive = true;
    void previewDeliveryOrderTaxesAction(customerId, dateIssued).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setTaxPreview(r.preview);
        setTaxPreviewError(null);
      } else {
        setTaxPreview(null);
        setTaxPreviewError(r.error);
      }
    });
    return () => {
      alive = false;
    };
  }, [
    customerId,
    dateIssued,
    authStatus,
    session?.userId,
    previewDeliveryOrderTaxesAction,
  ]);

  React.useEffect(() => {
    if (wp.openFinancialYear == null) return;
    const { minIso, maxIso } = workingMonthDateBounds(
      wp.workingCalendarYear,
      wp.workingCalendarMonth,
    );
    setDateIssued((prev) => {
      if (prev < minIso) return minIso;
      if (prev > maxIso) return maxIso;
      return prev;
    });
  }, [wp.openFinancialYear, wp.workingCalendarYear, wp.workingCalendarMonth]);

  React.useEffect(() => {
    if (session?.salesPoint?.id != null) {
      setSalesPointId(String(session.salesPoint.id));
    }
  }, [session?.salesPoint?.id]);

  const dateIssuedBounds =
    wp.openFinancialYear != null
      ? workingMonthDateBounds(wp.workingCalendarYear, wp.workingCalendarMonth)
      : null;

  function applyLoaded(data: LoadedDeliveryOrderView) {
    setOrderId(data.id);
    setDeliveryOrderNo(data.deliveryOrderNo);
    setCustomerId(data.customerId);
    setDateIssued(data.dateIssued);
    setOrderRef(data.orderRef ?? "");
    setSalesPointId(String(data.salesPointId));
    setLookupNo(data.deliveryOrderNo);
    setDocStatus(data.status);
    setValidatedByName(data.validatedByName ?? "");
    setValidatedAtIso(data.validatedAtIso ?? "");
    setLines(
      data.lines.length > 0
        ? data.lines.map((l) => ({
            productId: String(l.productId),
            orderQty: String(l.orderQty),
            orderUnit: l.orderUnit || "kg",
            unitPrice: l.unitPrice,
          }))
        : [emptyLine()],
    );
    setPayments(
      data.payments.length > 0
        ? data.payments.map((p) => ({
            method: p.method as Payment["method"],
            paymentDate: p.paymentDate,
            chequeNo: p.chequeNo,
            bank: p.bank,
            cashReceiptNo: p.cashReceiptNo,
            receiptDate: p.receiptDate,
          }))
        : [],
    );
    setBanner(null);
    if (data.postingCalendarYear != null && data.financialMonth != null) {
      wp.setWorkingCalendarMonth(data.postingCalendarYear, data.financialMonth);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetNew() {
    setOrderId(null);
    setDeliveryOrderNo("");
    setCustomerId("");
    setDateIssued(todayIsoDate());
    setOrderRef("");
    setSalesPointId(
      session?.salesPoint?.id != null ? String(session.salesPoint.id) : "",
    );
    setLookupNo("");
    setDocStatus(null);
    setValidatedByName("");
    setValidatedAtIso("");
    setLines(products.length > 0 ? [emptyLine()] : []);
    setPayments([]);
    setBanner(null);
  }

  async function onLoadByNo() {
    setBusy("load");
    setBanner(null);
    try {
      if (authStatus !== "ready" || !session?.userId) {
        setBanner({ type: "error", text: "Login required." });
        return;
      }
      const data = await loadDeliveryOrderByNo(lookupNo);
      if (!data) {
        setBanner({
          type: "error",
          text: "No delivery order matches that number, or you cannot access it.",
        });
        return;
      }
      applyLoaded(data);
      setBanner({ type: "ok", text: `Loaded ${data.deliveryOrderNo}.` });
    } finally {
      setBusy(null);
    }
  }

  async function onSaveHeader() {
    setBusy("header");
    setBanner(null);
    try {
      if (authStatus !== "ready" || !session?.userId) {
        setBanner({ type: "error", text: "Login required." });
        return;
      }
      if (!customerId.trim()) {
        setBanner({ type: "error", text: "Select a customer." });
        return;
      }
      const effectiveSalesPointId =
        session?.salesPoint?.id != null
          ? String(session.salesPoint.id)
          : salesPointId;
      if (!effectiveSalesPointId.trim()) {
        setBanner({ type: "error", text: "Select a collection point." });
        return;
      }
      const fd = new FormData();
      if (orderId != null) fd.set("id", String(orderId));
      fd.set("customerId", customerId);
      fd.set("dateIssued", dateIssued);
      fd.set("orderRef", orderRef);
      fd.set("salesPointId", effectiveSalesPointId);
      fd.set(
        "postingFinancialYear",
        wp.openFinancialYear != null ? String(wp.openFinancialYear) : "",
      );
      fd.set("postingCalendarYear", String(wp.workingCalendarYear));
      fd.set("postingCalendarMonth", String(wp.workingCalendarMonth));
      const r = await saveDeliveryOrderHeader(fd);
      if (r.ok) {
        setOrderId(r.id);
        setDeliveryOrderNo(r.deliveryOrderNo);
        setLookupNo(r.deliveryOrderNo);
        setDocStatus(ValidationStatus.PENDING);
        setBanner({
          type: "ok",
          text: orderId
            ? "Header updated. You can adjust lines and payments below."
            : `Created ${r.deliveryOrderNo}. You can now add lines and payments.`,
        });
        router.refresh();
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onDeleteOrderConfirmed() {
    if (orderId == null) return;
    const fd = new FormData();
    fd.set("id", String(orderId));
    const r = await deleteDeliveryOrder(fd);
    if (!r.ok) {
      setBanner({ type: "error", text: r.error });
      return;
    }
    resetNew();
    setBanner({ type: "ok", text: "Delivery order deleted." });
    router.refresh();
  }

  async function onValidateOrder() {
    if (orderId == null) return;
    if (authStatus !== "ready" || !session?.userId) {
      setBanner({ type: "error", text: "Login required." });
      return;
    }
    setBusy("validate");
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("id", String(orderId));
      const r = await validateDeliveryOrder(fd);
      if (r.ok) {
        setDocStatus(ValidationStatus.VALIDATED);
        setBanner({ type: "ok", text: "Delivery order validated." });
        router.refresh();
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onSaveLines() {
    if (orderId == null) return;
    if (authStatus !== "ready" || !session?.userId) {
      setBanner({ type: "error", text: "Login required." });
      return;
    }
    setBusy("lines");
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("deliveryOrderId", String(orderId));
      fd.set("lines", JSON.stringify(lines));
      const r = await saveDeliveryOrderDetails(fd);
      if (r.ok) {
        setBanner({ type: "ok", text: "Line items and taxes saved." });
        router.refresh();
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onSavePayments() {
    if (orderId == null) return;
    if (authStatus !== "ready" || !session?.userId) {
      setBanner({ type: "error", text: "Login required." });
      return;
    }
    setBusy("payments");
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("deliveryOrderId", String(orderId));
      fd.set("payments", JSON.stringify(payments));
      const r = await saveDeliveryOrderPayments(fd);
      if (r.ok) {
        setBanner({ type: "ok", text: "Payments saved." });
        router.refresh();
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
    }
  }

  const vatRateNum = taxPreview ? parseDec(taxPreview.vatRate) : 0;
  const otherRateNum = taxPreview ? parseDec(taxPreview.otherRate) : 0;

  const lineSummaries = lines.map((l) => {
    const q = Number.parseInt(l.orderQty, 10) || 0;
    const unit = parseDec(l.unitPrice);
    const net = Math.round(q * unit * 100) / 100;
    const regimeVat = Math.round(net * vatRateNum * 100) / 100;
    const regimeOther = Math.round(net * otherRateNum * 100) / 100;
    const vat = regimeVat;
    const other = regimeOther;
    const total = Math.round((net + vat + other) * 100) / 100;
    return { net, vat, other, total };
  });

  const totalsPreview = lineSummaries.reduce(
    (acc, s) => ({
      net: acc.net + s.net,
      vat: acc.vat + s.vat,
      other: acc.other + s.other,
      total: acc.total + s.total,
    }),
    { net: 0, vat: 0, other: 0, total: 0 },
  );

  const section2Disabled = orderId == null;
  const section3Disabled = orderId == null;

  const canDraftDO =
    authStatus === "ready" && session
      ? canCreateOrEditDeliveryOrderDraft(session.role)
      : false;
  const canValidateDO =
    authStatus === "ready" && session ? canValidateDeliveryOrder(session.role) : false;
  const draftFormLocked =
    docStatus === ValidationStatus.VALIDATED || !canDraftDO;
  const linesReadOnly =
    section2Disabled || docStatus === ValidationStatus.VALIDATED || !canDraftDO;
  const paymentsReadOnly =
    section3Disabled || docStatus === ValidationStatus.VALIDATED || !canDraftDO;

  return (
    <div className="space-y-8">
      <div className="space-y-1">      
        <h1 className="text-2xl font-semibold">Delivery order</h1>
        <p className="text-sm opacity-75">
          Senior sales supervisors prepare drafts (header, lines, payments). Managers validate
          pending orders. Open an order by number; clerks and supervisors can load to view or
          print (validated orders appear on their report).
        </p>
      </div>

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
        <div className="text-sm font-semibold">Open existing order</div>
        <p className="text-xs opacity-75">
          Enter the delivery order number (e.g. DO-2026-000001) to load the full
          document.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="grid gap-1 flex-1">
            <label className="text-xs font-medium opacity-70">
              Delivery order no.
            </label>
            <input
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
              value={lookupNo}
              onChange={(e) => setLookupNo(e.target.value)}
              placeholder="DO-2026-000001"
            />
          </div>
          <button
            type="button"
            disabled={busy !== null || !lookupNo.trim()}
            onClick={() => void onLoadByNo()}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy === "load" ? "Loading…" : "Load order"}
          </button>
          <button
            type="button"
            disabled={
              authStatus !== "ready" ||
              !session ||
              !canCreateOrEditDeliveryOrderDraft(session.role)
            }
            onClick={resetNew}
            className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
          >
            New blank order
          </button>
          {orderId != null ? (
            <Link
              href={`/delivery-orders/${orderId}`}
              className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm text-center hover:bg-black/5 dark:hover:bg-white/5"
            >
              View / print
            </Link>
          ) : null}
        </div>
        {orderId != null && deliveryOrderNo ? (
          <p className="text-xs opacity-75">
            Order <span className="font-medium tabular-nums">{deliveryOrderNo}</span> is
            open — use View / print for the printable document (new or loaded).
          </p>
        ) : null}
      </div>

      {customers.length === 0 || products.length === 0 || salesPoints.length === 0 ? (
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 text-sm">
          <div className="font-medium">Setup required</div>
          <ul className="list-disc pl-5 opacity-80 mt-2 space-y-1">
            {customers.length === 0 ? (
              <li>Add at least one customer.</li>
            ) : null}
            {products.length === 0 ? <li>Add at least one product.</li> : null}
            {salesPoints.length === 0 ? (
              <li>Add at least one sales / collection point.</li>
            ) : null}
          </ul>
          <div className="mt-3 flex gap-3">
            <Link className="underline underline-offset-4" href="/customers">
              Customers
            </Link>
            <Link className="underline underline-offset-4" href="/products">
              Products
            </Link>
            <Link className="underline underline-offset-4" href="/sales-points">
              Sales points
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Section 1 — DeliveryOrder header */}
          <section className="rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  1 · Delivery order (header)
                </h2>
                <p className="text-xs opacity-75 mt-1">
                  Saves to the{" "}
                  <code className="text-[11px]">DeliveryOrder</code> table.
                  Lines and payments need this ID.
                </p>
              </div>
              {deliveryOrderNo ? (
                <div className="text-sm">
                  <span className="opacity-70">Current no.</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {deliveryOrderNo}
                  </span>
                  {orderId != null ? (
                    <span className="opacity-70 text-xs ml-2">
                      · id {orderId}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {wp.openFinancialYear != null ? (
              <p className="text-xs opacity-75">
                <span className="font-medium">Posting period</span> (your working month):{" "}
                <span className="font-medium tabular-nums">
                  FY {wp.fyLabel} · {wp.workingMonthLabel}
                </span>
                . <span className="opacity-70">Date issued is the document date only.</span>
              </p>
            ) : (
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                No financial year is open — open one under Financial years before saving this order.
              </p>
            )}

            {docStatus ? (
              <p className="text-xs opacity-75">
                <span className="opacity-70">Status</span>{" "}
                <span className="font-medium">{docStatus}</span>
                {docStatus === ValidationStatus.VALIDATED ? (
                  <span className="opacity-70">
                    {" "}
                    · Validated by <span className="font-medium">{validatedByName || "—"}</span>
                    {validatedAtIso ? (
                      <span className="opacity-70">
                        {" "}
                        ({new Date(validatedAtIso).toISOString().slice(0, 16).replace("T", " ")})
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </p>
            ) : null}

            {orderId != null ? (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/delivery-orders/${orderId}`}
                  className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                >
                  View / print
                </Link>
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium leading-none"
                    htmlFor="do-customer"
                  >
                    Customer
                  </label>
                  <select
                    id="do-customer"
                    className="h-10 w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm box-border"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    required
                    disabled={draftFormLocked}
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
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium leading-none"
                    htmlFor="do-date-issued"
                  >
                    Date issued
                  </label>
                  <input
                    id="do-date-issued"
                    type="date"
                    className="h-10 w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm box-border"
                    value={dateIssued}
                    min={dateIssuedBounds?.minIso}
                    max={dateIssuedBounds?.maxIso}
                    onChange={(e) => setDateIssued(e.target.value)}
                    disabled={draftFormLocked || wp.openFinancialYear == null}
                  />
                </div>
              </div>
              <p className="text-xs opacity-70 -mt-1">
                {taxPreviewError ? (
                  <span className="text-amber-800 dark:text-amber-300">
                    {taxPreviewError}
                  </span>
                ) : taxPreview ? (
                  <>
                    Taxes from regime (date issued): VAT{" "}
                    <span className="font-medium">{taxPreview.vatPercentLabel}%</span>
                    {parseDec(taxPreview.otherRate) > 0 ? (
                      <>
                        {" "}
                        · {taxPreview.otherLabel ?? "Other"}{" "}
                        <span className="font-medium">
                          {taxPreview.otherPercentLabel}%
                        </span>
                      </>
                    ) : null}
                    . Optional per-line amount adds on top of statutory other taxes.
                  </>
                ) : customerId ? (
                  "Loading tax rates…"
                ) : (
                  "Select a customer and date to load tax rates."
                )}
              </p>
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium leading-none"
                    htmlFor="do-order-ref"
                  >
                    Customer reference (optional)
                  </label>
                  <input
                    id="do-order-ref"
                    className="h-10 w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm box-border"
                    value={orderRef}
                    onChange={(e) => setOrderRef(e.target.value)}
                    placeholder="PO / contract ref"
                    disabled={draftFormLocked}
                  />
                </div>
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium leading-none"
                    htmlFor="do-sales-point"
                  >
                    Collection point
                  </label>
                  {session?.salesPoint ? (
                    <>
                      <input
                        id="do-sales-point"
                        className="h-10 w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm box-border"
                        value={session.salesPoint.name}
                        readOnly
                      />
                      <p className="text-xs opacity-70">
                        Tied to your login; you cannot post to another collection
                        point.
                      </p>
                    </>
                  ) : (
                    <select
                      id="do-sales-point"
                      className="h-10 w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm box-border"
                      value={salesPointId}
                      onChange={(e) => setSalesPointId(e.target.value)}
                      required
                      disabled={draftFormLocked}
                    >
                      <option value="" disabled>
                        Select collection point
                      </option>
                      {salesPoints.map((sp) => (
                        <option key={sp.id} value={String(sp.id)}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy !== null || draftFormLocked}
                onClick={() => void onSaveHeader()}
                className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {busy === "header"
                  ? "Saving…"
                  : orderId != null
                    ? "Update header"
                    : "Save header (create order)"}
              </button>
              {orderId != null &&
              docStatus === ValidationStatus.PENDING &&
              session &&
              canValidateDO ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onValidateOrder()}
                  className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                >
                  {busy === "validate" ? "Validating…" : "Validate"}
                </button>
              ) : null}
              {orderId != null &&
              docStatus === ValidationStatus.PENDING &&
              canDraftDO ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    setPendingDelete({
                      id: orderId,
                      deliveryOrderNo: deliveryOrderNo || `ID ${orderId}`,
                    })
                  }
                  className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-600/10 disabled:opacity-50"
                >
                  Delete order
                </button>
              ) : null}
            </div>
          </section>

          {/* Section 2 — DeliveryOrderDetails */}
          <section
            className={`rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-6 space-y-4 ${
              section2Disabled ? "opacity-55 pointer-events-none" : ""
            }`}
          >
            <div>
              <h2 className="text-lg font-semibold">2 · Line items (Products) & taxes</h2>
              <p className="text-xs opacity-75 mt-1">
                Stored in{" "}
                <code className="text-[11px]">DeliveryOrderDetails</code>. Unit
                price is <span className="font-medium">excluding tax</span>. VAT
                and other statutory taxes follow the customer regime and{" "}
                <span className="font-medium">Tax types</span> schedule for the
                date issued.
              </p>
            </div>
            {section2Disabled ? (
              <p className="text-sm text-amber-800 dark:text-amber-200/90">
                Save the header in section 1 to enable line items.
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Lines</h3>
              <button
                type="button"
                disabled={linesReadOnly}
                className="text-sm underline underline-offset-4 disabled:opacity-40"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                Add line
              </button>
            </div>

            <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-x-auto">
              <div className="min-w-[900px] grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
                <div className="col-span-4">Product</div>
                <div className="col-span-1">Qty</div>
                <div className="col-span-1">Unit</div>
                <div className="col-span-2">Unit price (ex VAT)</div>
                <div className="col-span-2">Net</div>
                <div className="col-span-2"> </div>
              </div>
              {lines.map((l, idx) => {
                const s = lineSummaries[idx] ?? {
                  net: 0,
                  vat: 0,
                  other: 0,
                  total: 0,
                };
                return (
                  <div
                    key={idx}
                    className="min-w-[900px] border-b border-black/5 dark:border-white/5"
                  >
                    {/* Main line: product + qty + unit price + net */}
                    <div className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                      <div className="col-span-4">
                        <select
                          className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
                          value={l.productId}
                          disabled={linesReadOnly}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, productId: e.target.value } : x,
                              ),
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
                      <div className="col-span-1">
                        <input
                          className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                          inputMode="numeric"
                          value={l.orderQty}
                          disabled={linesReadOnly}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, orderQty: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                          value={l.orderUnit}
                          disabled={linesReadOnly}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, orderUnit: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1"
                          inputMode="decimal"
                          value={l.unitPrice}
                          placeholder="XAF"
                          disabled={linesReadOnly}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, unitPrice: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2 tabular-nums text-xs opacity-90">
                        {s.net.toFixed(2)}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button
                          type="button"
                          className="text-xs underline underline-offset-4 opacity-80"
                          onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={linesReadOnly || lines.length === 1}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* Taxes line: VAT + other taxes (auto) + line total */}
                    <div className="grid grid-cols-12 gap-2 px-3 pb-3 -mt-1 text-xs">
                      <div className="col-span-4 opacity-70">Taxes</div>
                      <div className="col-span-2 tabular-nums">
                        <span className="opacity-70">VAT:</span>{" "}
                        <span className="font-medium">{s.vat.toFixed(2)} XAF</span>
                      </div>
                      <div className="col-span-4 tabular-nums">
                        <span className="opacity-70">
                          {taxPreview?.otherLabel ? `${taxPreview.otherLabel}:` : "Other taxes:"}
                        </span>{" "}
                        <span className="font-medium">{s.other.toFixed(2)} XAF</span>
                      </div>
                      <div className="col-span-2 text-right tabular-nums">
                        <span className="opacity-70">Total:</span>{" "}
                        <span className="font-semibold">{s.total.toFixed(2)} XAF</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-end gap-x-8 gap-y-1 text-sm">
              <div className="tabular-nums">
                <span className="opacity-70">Net (ex VAT)</span>{" "}
                <span className="font-medium">
                  {totalsPreview.net.toFixed(2)} XAF
                </span>
              </div>
              <div className="tabular-nums">
                <span className="opacity-70">VAT</span>{" "}
                <span className="font-medium">
                  {totalsPreview.vat.toFixed(2)} XAF
                </span>
              </div>
              <div className="tabular-nums">
                <span className="opacity-70">Other taxes</span>{" "}
                <span className="font-medium">
                  {totalsPreview.other.toFixed(2)} XAF
                </span>
              </div>
              <div className="tabular-nums">
                <span className="opacity-70">Total</span>{" "}
                <span className="font-semibold">
                  {totalsPreview.total.toFixed(2)} XAF
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={
                linesReadOnly ||
                busy !== null ||
                Boolean(taxPreviewError) ||
                taxPreview == null
              }
              onClick={() => void onSaveLines()}
              className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy === "lines" ? "Saving…" : "Save line items & taxes"}
            </button>
          </section>

          {/* Section 3 — DeliveryOrderPaymentDetails */}
          <section
            className={`rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-6 space-y-4 ${
              section3Disabled ? "opacity-55 pointer-events-none" : ""
            }`}
          >
            <div>
              <h2 className="text-lg font-semibold">3 · Payments</h2>
              <p className="text-xs opacity-75 mt-1">
                Stored in{" "}
                <code className="text-[11px]">DeliveryOrderPaymentDetails</code>
                . Optional; save whenever advance or instalment payments are
                recorded.
              </p>
            </div>
            {section3Disabled ? (
              <p className="text-sm text-amber-800 dark:text-amber-200/90">
                Save the header in section 1 to record payments.
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Payment rows</h3>
              <button
                type="button"
                disabled={paymentsReadOnly}
                className="text-sm underline underline-offset-4 disabled:opacity-40"
                onClick={() =>
                  setPayments((prev) => [
                    ...prev,
                    {
                      method: "CASH",
                      paymentDate: todayIsoDate(),
                      chequeNo: "",
                      bank: "",
                      cashReceiptNo: "",
                      receiptDate: "",
                    },
                  ])
                }
              >
                Add payment
              </button>
            </div>

            {payments.length === 0 ? (
              <p className="text-sm opacity-70">
                No payments on this order yet.
              </p>
            ) : (
              <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden space-y-0">
                {payments.map((p, idx) => (
                  <div
                    key={idx}
                    className="overflow-x-auto px-3 py-3 border-b border-black/10 dark:border-white/10 last:border-b-0"
                  >
                    <div className="min-w-[1100px] flex items-end gap-3">
                      <div className="grid gap-1 w-[260px] shrink-0">
                        <label className="text-xs font-medium opacity-70">Method</label>
                        <div className="flex flex-wrap items-center gap-3 rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name={`do-payment-method-${idx}`}
                              value="CASH"
                              checked={p.method === "CASH"}
                              disabled={paymentsReadOnly}
                              onChange={() =>
                                setPayments((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          method: "CASH",
                                          chequeNo: "",
                                          bank: "",
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                            Cash
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name={`do-payment-method-${idx}`}
                              value="CHEQUE"
                              checked={p.method === "CHEQUE"}
                              disabled={paymentsReadOnly}
                              onChange={() =>
                                setPayments((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          method: "CHEQUE",
                                          cashReceiptNo: "",
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                            Cheque
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-1 w-[170px] shrink-0">
                        <label className="text-xs font-medium opacity-70">Date issued</label>
                        <input
                          type="date"
                          className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm"
                          value={p.paymentDate}
                          disabled={paymentsReadOnly}
                          onChange={(e) =>
                            setPayments((prev) =>
                              prev.map((x, i) =>
                                i === idx ? { ...x, paymentDate: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>

                      {p.method === "CHEQUE" ? (
                        <>
                          <div className="grid gap-1 w-[220px] shrink-0">
                            <label className="text-xs font-medium opacity-70">Cheque no.</label>
                            <input
                              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm"
                              placeholder="Cheque no."
                              value={p.chequeNo}
                              disabled={paymentsReadOnly}
                              onChange={(e) =>
                                setPayments((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, chequeNo: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-1 w-[220px] shrink-0">
                            <label className="text-xs font-medium opacity-70">Bank</label>
                            <input
                              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm"
                              placeholder="Bank"
                              value={p.bank}
                              disabled={paymentsReadOnly}
                              onChange={(e) =>
                                setPayments((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, bank: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid gap-1 w-[260px] shrink-0">
                            <label className="text-xs font-medium opacity-70">CDC receipt no.</label>
                            <input
                              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-2 py-1.5 text-sm"
                              placeholder="CDC receipt no."
                              value={p.cashReceiptNo}
                              disabled={paymentsReadOnly}
                              onChange={(e) =>
                                setPayments((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, cashReceiptNo: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                          </div>
                        </>
                      )}

                      <div className="ml-auto flex justify-end">
                        <button
                          type="button"
                          className="text-xs underline underline-offset-4 disabled:opacity-40"
                          disabled={paymentsReadOnly}
                          onClick={() => setPayments((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              disabled={paymentsReadOnly || busy !== null}
              onClick={() => void onSavePayments()}
              className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy === "payments" ? "Saving…" : "Save payments"}
            </button>
          </section>
        </>
      )}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this delivery order?"
          description={`“${pendingDelete.deliveryOrderNo}” will be removed permanently. Line items and payments will also be deleted. You cannot undo this action.`}
          confirmLabel="Delete delivery order"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            setPendingDelete(null);
            await onDeleteOrderConfirmed();
          }}
        />
      ) : null}

      {/* Recent list removed: use "Open existing order" above and "View / print" once loaded. */}
    </div>
  );
}
