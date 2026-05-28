"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useWorkingPeriod,
  workingMonthDateBounds,
} from "@/contexts/WorkingPeriodContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";
import { canCreateOrEditDeliveryOrderDraft } from "@/lib/auth-roles";
import { ValidationStatus } from "@/lib/domain";
import type {
  DeliveryOrderTaxPreview,
  LoadedDeliveryOrderView,
  PendingDeliveryOrderRow,
  SaveHeaderResult,
  SaveSectionResult,
} from "./actions";

type Customer = { id: string; name: string; vatApplies: boolean };
type Product = {
  productId: number;
  productName: string;
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
  initialLookupNo?: string;
  customers: Customer[];
  products: Product[];
  salesPoints: SalesPointOpt[];
  previewDeliveryOrderTaxesAction: (
    customerId: string,
    dateIssuedIso: string,
  ) => Promise<
    | { ok: true; preview: DeliveryOrderTaxPreview }
    | { ok: false; error: string }
  >;
  loadDeliveryOrderByNo: (
    no: string,
  ) => Promise<LoadedDeliveryOrderView | null>;
  saveDeliveryOrder: (formData: FormData) => Promise<SaveHeaderResult>;
  deleteDeliveryOrder: (formData: FormData) => Promise<SaveSectionResult>;
  validateDeliveryOrder: (formData: FormData) => Promise<SaveSectionResult>;
  cancelValidatedDeliveryOrder: (formData: FormData) => Promise<SaveSectionResult>;
  canValidateDeliveryOrder: boolean;
  previewProductUnitPriceAction: (
    customerId: string,
    productId: number,
    dateIso: string,
  ) => Promise<
    { ok: true; unitPriceExTax: string } | { ok: false; error: string }
  >;
  previewStockOnHandAction: (
    salesPointId: number,
    productId: number,
  ) => Promise<{ ok: true; onHand: string } | { ok: false; error: string }>;
  listPendingDeliveryOrdersAction: () => Promise<PendingDeliveryOrderRow[]>;
}) {
  const {
    initialLookupNo,
    customers,
    products,
    salesPoints,
    previewDeliveryOrderTaxesAction,
    loadDeliveryOrderByNo,
    saveDeliveryOrder,
    deleteDeliveryOrder,
    validateDeliveryOrder,
    cancelValidatedDeliveryOrder,
    canValidateDeliveryOrder: canValidateDeliveryOrderProp,
    previewProductUnitPriceAction,
    previewStockOnHandAction,
    listPendingDeliveryOrdersAction,
  } = props;

  const wp = useWorkingPeriod();
  const { status: authStatus, session } = useAuth();
  const router = useRouter();

  const [taxPreview, setTaxPreview] =
    React.useState<DeliveryOrderTaxPreview | null>(null);
  const [taxPreviewError, setTaxPreviewError] = React.useState<string | null>(
    null,
  );

  const [orderId, setOrderId] = React.useState<number | null>(null);
  const [deliveryOrderNo, setDeliveryOrderNo] = React.useState("");
  const [customerId, setCustomerId] = React.useState("");
  const [dateIssued, setDateIssued] = React.useState(todayIsoDate);
  const [orderRef, setOrderRef] = React.useState("");
  const [salesPointId, setSalesPointId] = React.useState<string>("");
  const [lookupNo, setLookupNo] = React.useState(() =>
    String(props.initialLookupNo ?? "").trim(),
  );
  const [docStatus, setDocStatus] = React.useState<ValidationStatus | null>(
    null,
  );
  const [validatedByName, setValidatedByName] = React.useState("");
  const [validatedAtIso, setValidatedAtIso] = React.useState("");
  const [cancelledReason, setCancelledReason] = React.useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [cancelReasonDraft, setCancelReasonDraft] = React.useState("");
  const [correctionDialogOpen, setCorrectionDialogOpen] = React.useState(false);
  const [payments, setPayments] = React.useState<Payment[]>([]);
  const [lines, setLines] = React.useState<LineRow[]>(() =>
    products.length > 0
      ? [
          {
            productId: "",
            orderQty: "0",
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
  /** When false, line unit prices keep values from the server (loaded order) until the user edits customer, date, or product. */
  const [allowAutoUnitPrice, setAllowAutoUnitPrice] = React.useState(true);
  const [linePriceErrors, setLinePriceErrors] = React.useState<
    Record<number, string>
  >({});
  /**
   * Per-line on-hand snapshot at the DO's sales point, indexed by line row index.
   * Informational only — used to nudge the user when their committed qty looks
   * higher than what's currently sitting at the destination point. Stored as a
   * number string so we can format it without import gymnastics.
   */
  const [lineOnHand, setLineOnHand] = React.useState<Record<number, string>>(
    {},
  );
  /**
   * Director-only: pre-fetched list of PENDING delivery orders that this user is
   * allowed to see. Powers the combo picker on the "Open existing order" card
   * so the lookup input doubles as a "pick from awaiting-validation" combo.
   * Empty for non-managers.
   */
  const [pendingDOs, setPendingDOs] = React.useState<PendingDeliveryOrderRow[]>(
    [],
  );
  const [pendingPickerOpen, setPendingPickerOpen] = React.useState(false);
  const pendingPickerRef = React.useRef<HTMLDivElement | null>(null);

  function emptyLine(): LineRow {
    return {
      productId: "",
      orderQty: "0",
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

  const lineProductKey = lines.map((l) => l.productId).join(",");

  React.useEffect(() => {
    if (!allowAutoUnitPrice) return;
    if (!customerId || authStatus !== "ready") return;
    if (!dateIssued) return;
    let alive = true;
    setLinePriceErrors({});
    void (async () => {
      const errs: Record<number, string> = {};
      const priceByIdx: Record<number, string> = {};
      await Promise.all(
        lines.map(async (l, idx) => {
          const pid = Number.parseInt(l.productId, 10);
          if (!Number.isFinite(pid)) return;
          const r = await previewProductUnitPriceAction(
            customerId,
            pid,
            dateIssued,
          );
          if (!alive) return;
          if (r.ok) priceByIdx[idx] = r.unitPriceExTax;
          else errs[idx] = r.error;
        }),
      );
      if (!alive) return;
      setLinePriceErrors(errs);
      setLines((prev) =>
        prev.map((row, i) =>
          priceByIdx[i] != null ? { ...row, unitPrice: priceByIdx[i]! } : row,
        ),
      );
    })();
    return () => {
      alive = false;
    };
  }, [
    allowAutoUnitPrice,
    customerId,
    dateIssued,
    lineProductKey,
    authStatus,
    previewProductUnitPriceAction,
  ]);

  // Director combo: fetch the (scope-respecting) list of PENDING DOs once the
  // session is ready and the user is allowed to validate. The server action
  // returns [] for anyone who can't validate, so this also covers the
  // not-a-manager case without an extra client-side guard.
  React.useEffect(() => {
    if (authStatus !== "ready" || !session || !canValidateDeliveryOrderProp) {
      setPendingDOs([]);
      return;
    }
    let alive = true;
    void listPendingDeliveryOrdersAction().then((rows) => {
      if (!alive) return;
      setPendingDOs(rows);
    });
    return () => {
      alive = false;
    };
  }, [
    authStatus,
    session,
    canValidateDeliveryOrderProp,
    listPendingDeliveryOrdersAction,
  ]);

  // Close the pending-DO picker on outside click or Escape.
  React.useEffect(() => {
    if (!pendingPickerOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!pendingPickerRef.current) return;
      if (!pendingPickerRef.current.contains(event.target as Node)) {
        setPendingPickerOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setPendingPickerOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pendingPickerOpen]);

  // Informational on-hand lookup per line. Re-runs whenever the sales point
  // changes or any line swaps products. Failures are swallowed (we just clear
  // the badge for that row) — this is a soft notice, never blocking.
  React.useEffect(() => {
    if (authStatus !== "ready") return;
    const spid = Number.parseInt(salesPointId, 10);
    if (!Number.isFinite(spid) || spid <= 0) {
      setLineOnHand({});
      return;
    }
    let alive = true;
    void (async () => {
      const next: Record<number, string> = {};
      await Promise.all(
        lines.map(async (l, idx) => {
          const pid = Number.parseInt(l.productId, 10);
          if (!Number.isFinite(pid) || pid <= 0) return;
          const r = await previewStockOnHandAction(spid, pid);
          if (!alive) return;
          if (r.ok) next[idx] = r.onHand;
        }),
      );
      if (!alive) return;
      setLineOnHand(next);
    })();
    return () => {
      alive = false;
    };
  }, [authStatus, salesPointId, lineProductKey, previewStockOnHandAction]);

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
    setCancelledReason("");
    setAllowAutoUnitPrice(false);
    setLinePriceErrors({});
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
    setCancelledReason("");
    setAllowAutoUnitPrice(true);
    setLinePriceErrors({});
    setLines(products.length > 0 ? [emptyLine()] : []);
    setPayments([]);
    setBanner(null);
  }

  async function onLoadByNo(explicit?: string) {
    const no = String(explicit ?? lookupNo ?? "").trim();
    if (!no) return;
    setBusy("load");
    setBanner(null);
    try {
      if (authStatus !== "ready" || !session?.userId) {
        setBanner({ type: "error", text: "Login required." });
        return;
      }
      const data = await loadDeliveryOrderByNo(no);
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

  // Optional deep-link: /delivery-orders?no=DO-2026-000001
  React.useEffect(() => {
    const no = String(initialLookupNo ?? "").trim();
    if (!no) return;
    setLookupNo(no);
    void onLoadByNo(no);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLookupNo]);

  async function onSave() {
    setBusy("save");
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
      if (lines.length === 0) {
        setBanner({ type: "error", text: "Add at least one line item." });
        return;
      }
      const missingProductIdx = lines.findIndex((l) => !l.productId.trim());
      if (missingProductIdx !== -1) {
        setBanner({
          type: "error",
          text: `Select a product on line ${missingProductIdx + 1}.`,
        });
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
      fd.set("lines", JSON.stringify(lines));
      fd.set("payments", JSON.stringify(payments));
      const r = await saveDeliveryOrder(fd);
      if (r.ok) {
        const wasNew = orderId == null;
        setOrderId(r.id);
        setDeliveryOrderNo(r.deliveryOrderNo);
        setLookupNo(r.deliveryOrderNo);
        setDocStatus(ValidationStatus.PENDING);
        setBanner({
          type: "ok",
          text: wasNew
            ? `Created ${r.deliveryOrderNo}.`
            : "Delivery order updated.",
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
        if (canValidateDeliveryOrderProp) {
          void listPendingDeliveryOrdersAction().then(setPendingDOs);
        }
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
    }
  }

  async function onCancelValidatedOrder() {
    if (orderId == null) return;
    if (authStatus !== "ready" || !session?.userId) {
      setBanner({ type: "error", text: "Login required." });
      return;
    }
    if (session.role !== "MANAGER") {
      setBanner({
        type: "error",
        text: "Only managers can cancel a validated delivery order.",
      });
      return;
    }
    setCancelReasonDraft(cancelledReason || "");
    setCancelDialogOpen(true);
  }

  async function confirmCancelValidatedOrder() {
    if (orderId == null) return;
    const trimmed = cancelReasonDraft.trim();
    if (!trimmed) {
      setBanner({ type: "error", text: "Cancellation reason is required." });
      return;
    }
    setCancelledReason(trimmed);
    setBusy("validate");
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("id", String(orderId));
      fd.set("reason", trimmed);
      const r = await cancelValidatedDeliveryOrder(fd);
      if (r.ok) {
        setDocStatus(ValidationStatus.REJECTED);
        setBanner({ type: "ok", text: "Delivery order cancelled." });
        router.refresh();
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
      setCancelDialogOpen(false);
    }
  }

  function applyStartCorrectionFromCurrent() {
    if (!deliveryOrderNo || !orderId) return;
    const originalNo = deliveryOrderNo;
    const originalRef = orderRef;

    // Turn the current in-memory document into a new draft by clearing identity/status,
    // while keeping the editable fields prefilled for quick correction.
    setOrderId(null);
    setDeliveryOrderNo("");
    setLookupNo("");
    setDocStatus(null);
    setValidatedByName("");
    setValidatedAtIso("");
    setCancelledReason("");
    setAllowAutoUnitPrice(true);
    setBanner({
      type: "ok",
      text: `New correction draft started. Update fields then Save. Refers to ${originalNo}.`,
    });
    setOrderRef(originalRef?.trim() ? `${originalRef} (Correction for ${originalNo})` : `Correction for ${originalNo}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
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


  const canDraftDO =
    authStatus === "ready" && session
      ? canCreateOrEditDeliveryOrderDraft(session.role)
      : false;
  const canValidateDO =
    authStatus === "ready" && session && canValidateDeliveryOrderProp;
  const draftFormLocked =
    docStatus === ValidationStatus.VALIDATED || !canDraftDO;
  const linesReadOnly = draftFormLocked;
  const paymentsReadOnly = draftFormLocked;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Delivery order</h1>
        <p className="text-sm opacity-75">
          {session?.salesPoint ? (
            <>
              You can load and print{" "}
              <span className="font-medium">validated</span> delivery orders at
              your collection point only. Pending drafts are prepared by senior
              supervisors and validated by managers before they appear here.
            </>
          ) : (
            <>
              Senior sales supervisors prepare drafts (header, lines, payments).
              Directors validate pending orders. Open an order by number to view
              or print.
            </>
          )}
        </p>
        {session?.role === "MANAGER" ? (
          <div className="pt-2">
            <Link
              href="/delivery-orders/validation-queue"
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent/25"
            >
              Open validation queue (bulk)
            </Link>
          </div>
        ) : null}
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

      <div className="rounded-lg border border-border p-4 sm:p-5 space-y-3">
        <div className="text-sm font-semibold">Open existing order</div>
        <p className="text-xs opacity-75">
          Enter the delivery order number (e.g. DO-2026-000001) to load the full
          document.
          {canValidateDO ? (
            <>
              {" "}
              You can also pick one from the list of orders awaiting validation.
            </>
          ) : null}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="grid gap-1 flex-1">
            <label className="text-xs font-medium opacity-70">
              Delivery order no.
            </label>
            <div className="relative" ref={pendingPickerRef}>
              <div className="flex">
                <input
                  className={
                    canValidateDO
                      ? "flex-1 rounded-l-md border border-border border-r-0 bg-transparent px-3 py-2 text-sm focus:outline-none"
                      : "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  }
                  value={lookupNo}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLookupNo(next);
                    if (
                      canValidateDO &&
                      pendingDOs.some((d) => d.deliveryOrderNo === next)
                    ) {
                      void onLoadByNo(next);
                    }
                  }}
                  placeholder="DO-2026-000001"
                />
                {canValidateDO ? (
                  <button
                    type="button"
                    aria-label="Pick from orders awaiting validation"
                    aria-haspopup="listbox"
                    aria-expanded={pendingPickerOpen}
                    title={
                      pendingDOs.length === 0
                        ? "No orders awaiting validation"
                        : `Pick from ${pendingDOs.length} pending order${pendingDOs.length === 1 ? "" : "s"}`
                    }
                    onClick={() => setPendingPickerOpen((v) => !v)}
                    className="rounded-r-md border border-border bg-accent/10 px-3 py-2 text-sm hover:bg-accent/25 focus:outline-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="opacity-70">
                        {pendingDOs.length}
                      </span>
                      <span aria-hidden="true">{pendingPickerOpen ? "\u25b4" : "\u25be"}</span>
                    </span>
                  </button>
                ) : null}
              </div>
              {canValidateDO && pendingPickerOpen ? (
                <div
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-72 w-full min-w-88 overflow-auto rounded-md border border-border bg-background shadow-lg"
                >
                  {pendingDOs.length === 0 ? (
                    <div className="px-3 py-3 text-xs opacity-70">
                      No delivery orders are currently awaiting validation.
                    </div>
                  ) : (
                    <ul className="py-1">
                      {pendingDOs.map((d) => (
                        <li key={d.deliveryOrderNo}>
                          <button
                            type="button"
                            role="option"
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-accent/25 focus:bg-accent/25 focus:outline-none"
                            onClick={() => {
                              setLookupNo(d.deliveryOrderNo);
                              setPendingPickerOpen(false);
                              void onLoadByNo(d.deliveryOrderNo);
                            }}
                          >
                            <div className="font-medium tabular-nums">
                              {d.deliveryOrderNo}
                            </div>
                            <div className="text-xs opacity-75">
                              {d.customerName}
                              {" \u00b7 "}
                              {d.dateIssued}
                              {d.totalLabel ? ` \u00b7 ${d.totalLabel}` : ""}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            disabled={busy !== null || !lookupNo.trim()}
            onClick={() => void onLoadByNo()}
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
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
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent/25 disabled:opacity-50"
          >
            New blank order
          </button>
          {orderId != null ? (
            <Link
              href={`/delivery-orders/${orderId}`}
              className="rounded-md border border-border px-4 py-2 text-sm text-center hover:bg-accent/25"
            >
              View / print
            </Link>
          ) : null}
        </div>
        {orderId != null && deliveryOrderNo ? (
          <p className="text-xs opacity-75">
            Order{" "}
            <span className="font-medium tabular-nums">{deliveryOrderNo}</span>{" "}
            is open — use View / print for the printable document (new or
            loaded).
          </p>
        ) : null}
      </div>

      {customers.length === 0 ||
      products.length === 0 ||
      salesPoints.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-sm">
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
          <section className="rounded-lg border border-border p-4 sm:p-6 space-y-4">
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
                <span className="font-medium">Posting period</span> (your
                working month):{" "}
                <span className="font-medium tabular-nums">
                  FY {wp.fyLabel} · {wp.workingMonthLabel}
                </span>
                .{" "}
                <span className="opacity-70">
                  Date issued is the document date only.
                </span>
              </p>
            ) : (
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                No financial year is open — open one under Financial years
                before saving this order.
              </p>
            )}

            {docStatus ? (
              <p
                className={`text-xs rounded-md border px-2 py-1 ${
                  docStatus === ValidationStatus.VALIDATED
                    ? "bg-emerald-600/10 border-emerald-600/30 text-emerald-900 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-200"
                    : docStatus === ValidationStatus.REJECTED
                      ? "bg-red-600/10 border-red-600/30 text-red-900 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200"
                      : "bg-amber-500/15 border-amber-500/30 text-amber-900 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-200"
                }`}
              >
                <span className="opacity-70">Status</span>{" "}
                <span className="font-semibold uppercase tracking-wide">
                  {docStatus}
                </span>
                {docStatus === ValidationStatus.VALIDATED ? (
                  <span className="opacity-80">
                    {" "}
                    · Validated by{" "}
                    <span className="font-medium">
                      {validatedByName || "—"}
                    </span>
                    {validatedAtIso ? (
                      <span className="opacity-80">
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
            ) : null}

            {orderId != null &&
            docStatus === ValidationStatus.VALIDATED &&
            session?.role === "MANAGER" &&
            canValidateDO ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onCancelValidatedOrder()}
                  className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-4 py-2 text-sm font-medium hover:bg-red-600/10 disabled:opacity-50"
                >
                  Cancel validated DO (correction)
                </button>
              </div>
            ) : null}

            {orderId != null &&
            docStatus === ValidationStatus.REJECTED &&
            canDraftDO ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setCorrectionDialogOpen(true)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/25 disabled:opacity-50"
                >
                  Start correction (new DO)
                </button>
              </div>
            ) : null}

            {cancelDialogOpen && orderId != null ? (
              <ConfirmDialog
                title="Cancel validated delivery order?"
                description={`This will mark “${deliveryOrderNo || `ID ${orderId}`}” as cancelled (REJECTED) and preserve it for audit. Then create a new correction DO.`}
                confirmLabel="Cancel validated DO"
                confirmTone="danger"
                cancelLabel="Back"
                onCancel={() => setCancelDialogOpen(false)}
                onConfirm={confirmCancelValidatedOrder}
              >
                <div className="space-y-1">
                  <label className="text-xs font-medium opacity-70">
                    Cancellation reason
                  </label>
                  <textarea
                    className="min-h-24 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                    value={cancelReasonDraft}
                    onChange={(e) => setCancelReasonDraft(e.target.value)}
                    placeholder="Describe the error and why this DO is being cancelled…"
                  />
                  <div className="text-[11px] opacity-70">
                    This reason is stored on the cancelled DO for audit.
                  </div>
                </div>
              </ConfirmDialog>
            ) : null}

            {correctionDialogOpen && orderId != null ? (
              <ConfirmDialog
                title="Start a correction delivery order?"
                description={`This will create a NEW draft (the cancelled DO remains unchanged). The new draft will reference “${deliveryOrderNo || `ID ${orderId}`}”.`}
                confirmLabel="Start correction"
                confirmTone="neutral"
                cancelLabel="Back"
                onCancel={() => setCorrectionDialogOpen(false)}
                onConfirm={() => {
                  setCorrectionDialogOpen(false);
                  applyStartCorrectionFromCurrent();
                }}
              />
            ) : null}

            {orderId != null ? (
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/delivery-orders/${orderId}`}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent/25"
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
                    className="h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm box-border"
                    value={customerId}
                    onChange={(e) => {
                      setAllowAutoUnitPrice(true);
                      setCustomerId(e.target.value);
                    }}
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
                    className="h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm box-border"
                    value={dateIssued}
                    min={dateIssuedBounds?.minIso}
                    max={dateIssuedBounds?.maxIso}
                    onChange={(e) => {
                      setAllowAutoUnitPrice(true);
                      setDateIssued(e.target.value);
                    }}
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
                    <span className="font-medium">
                      {taxPreview.vatPercentLabel}%
                    </span>
                    {parseDec(taxPreview.otherRate) > 0 ? (
                      <>
                        {" "}
                        · {taxPreview.otherLabel ?? "Other"}{" "}
                        <span className="font-medium">
                          {taxPreview.otherPercentLabel}%
                        </span>
                      </>
                    ) : null}
                    . Optional per-line amount adds on top of statutory other
                    taxes.
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
                    className="h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm box-border"
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
                        className="h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm box-border"
                        value={session.salesPoint.name}
                        readOnly
                      />
                      <p className="text-xs opacity-70">
                        Tied to your login; you cannot post to another
                        collection point.
                      </p>
                    </>
                  ) : (
                    <select
                      id="do-sales-point"
                      className="h-10 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm box-border"
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

          </section>

          {/* Section 2 — DeliveryOrderDetails */}
          <section className="rounded-lg border border-border p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">
                2 · Line items (Products) & taxes
              </h2>
              <p className="text-xs opacity-75 mt-1">
                Stored in{" "}
                <code className="text-[11px]">DeliveryOrderDetails</code>. Unit
                price is <span className="font-medium">excluding tax</span>. VAT
                and other statutory taxes follow the customer regime and{" "}
                <span className="font-medium">Tax types</span> schedule for the
                date issued.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Lines</h3>
              <button
                type="button"
                disabled={linesReadOnly}
                className="text-sm underline underline-offset-4 disabled:opacity-40"
                onClick={() => {
                  setAllowAutoUnitPrice(true);
                  setLines((prev) => [...prev, emptyLine()]);
                }}
              >
                Add line
              </button>
            </div>
            <p className="text-xs opacity-70">
              Unit price (ex VAT) comes from{" "}
              <Link
                href="/setup/product-pricing"
                className="underline underline-offset-4"
              >
                Product pricing
              </Link>{" "}
              for the customer type and document date; it cannot be edited here.
            </p>

            <div className="space-y-3">
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
                    className="rounded-lg border border-border p-3 sm:p-4 space-y-3 min-w-0"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-medium opacity-70">
                        Product
                      </div>
                      <select
                        className="w-full min-w-0 max-w-full rounded-md border border-border bg-transparent px-2 py-2 text-sm"
                        value={l.productId}
                        disabled={linesReadOnly}
                        onChange={(e) => {
                          setAllowAutoUnitPrice(true);
                          setLines((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, productId: e.target.value }
                                : x,
                            ),
                          );
                        }}
                      >
                        <option value="" disabled>
                          Select product
                        </option>
                        {products.map((g) => (
                          <option key={g.productId} value={String(g.productId)}>
                            {g.productName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0">
                      <div className="space-y-1 min-w-0">
                        <label className="text-xs font-medium opacity-70">
                          Qty
                        </label>
                        <input
                          className="w-full min-w-0 rounded-md border border-border bg-transparent px-2 py-2 text-sm"
                          inputMode="numeric"
                          value={l.orderQty}
                          disabled={linesReadOnly}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, orderQty: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                        {lineOnHand[idx] != null
                          ? (() => {
                              const onHand = parseDec(lineOnHand[idx]!);
                              const qty = parseDec(l.orderQty);
                              const over = qty > onHand;
                              const fmt = onHand.toLocaleString(undefined, {
                                maximumFractionDigits: 3,
                              });
                              return (
                                <p
                                  className={
                                    over
                                      ? "text-[10px] text-amber-800 dark:text-amber-200/90 leading-snug"
                                      : "text-[10px] opacity-70 leading-snug"
                                  }
                                >
                                  {over
                                    ? `Above on-hand at this sales point (${fmt} ${l.orderUnit || ""}). Informational only — DO will still save.`
                                    : `On-hand at this sales point: ${fmt} ${l.orderUnit || ""}`}
                                </p>
                              );
                            })()
                          : null}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <label className="text-xs font-medium opacity-70">
                          Unit
                        </label>
                        <input
                          className="w-full min-w-0 rounded-md border border-border bg-transparent px-2 py-2 text-sm"
                          value={l.orderUnit}
                          disabled={linesReadOnly}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, orderUnit: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1 min-w-0 col-span-2 sm:col-span-1">
                        <label className="text-xs font-medium opacity-70">
                          Unit price (ex VAT)
                        </label>
                        <input
                          className="w-full min-w-0 rounded-md border border-border bg-foreground/6 px-2 py-2 text-sm"
                          inputMode="decimal"
                          value={l.unitPrice}
                          placeholder="—"
                          readOnly
                          title="Resolved from product pricing schedules"
                          disabled={linesReadOnly}
                        />
                        {linePriceErrors[idx] ? (
                          <p className="text-[10px] text-amber-800 dark:text-amber-200/90 leading-snug">
                            {linePriceErrors[idx]}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1 min-w-0 col-span-2 sm:col-span-1">
                        <label className="text-xs font-medium opacity-70">
                          Net (ex VAT)
                        </label>
                        <input
                          className="w-full min-w-0 rounded-md border border-border bg-foreground/6 px-2 py-2 text-sm text-right tabular-nums font-medium"
                          inputMode="decimal"
                          value={s.net.toFixed(2)}
                          readOnly
                          disabled
                          title="Calculated from quantity × unit price"
                        />
                      </div>
                    </div>

                    {/*  <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs border-t border-border pt-3">
                      <span className="opacity-70 font-medium">Taxes</span>
                      <span className="tabular-nums">
                        <span className="opacity-70">VAT:</span>{" "}
                        <span className="font-medium">{s.vat.toFixed(2)} XAF</span>
                      </span>
                      <span className="tabular-nums min-w-0">
                        <span className="opacity-70">
                          {taxPreview?.otherLabel ? `${taxPreview.otherLabel}:` : "Other taxes:"}
                        </span>{" "}
                        <span className="font-medium">{s.other.toFixed(2)} XAF</span>
                      </span>
                      <span className="tabular-nums sm:ml-auto">
                        <span className="opacity-70">Line total:</span>{" "}
                        <span className="font-semibold">{s.total.toFixed(2)} XAF</span>
                      </span>
                    </div> */}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="text-xs underline underline-offset-4 opacity-80"
                        onClick={() =>
                          setLines((prev) => prev.filter((_, i) => i !== idx))
                        }
                        disabled={linesReadOnly || lines.length === 1}
                      >
                        Remove line
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end text-sm">
              <div className="min-w-[16rem] space-y-1">
               {/*  <div className="flex justify-between gap-6 tabular-nums">
                  <span className="opacity-70">Net (ex VAT)</span>
                  <span className="font-medium text-right">
                    {totalsPreview.net.toFixed(2)} XAF
                  </span>
                </div> */}
                <div className="flex justify-between gap-6 tabular-nums">
                  <span className="opacity-70">VAT</span>
                  <span className="font-medium text-right">
                    {totalsPreview.vat.toFixed(2)} XAF
                  </span>
                </div>
                <div className="flex justify-between gap-6 tabular-nums">
                  <span className="opacity-70">Sales tax</span>
                  <span className="font-medium text-right">
                    {totalsPreview.other.toFixed(2)} XAF
                  </span>
                </div>
                <div className="flex justify-between gap-6 tabular-nums border-t border-border pt-1">
                  <span className="opacity-70">Total</span>
                  <span className="font-semibold text-right">
                    {totalsPreview.total.toFixed(2)} XAF
                  </span>
                </div>
              </div>
            </div>

          </section>

          {/* Section 3 — DeliveryOrderPaymentDetails */}
          <section className="rounded-lg border border-border p-4 sm:p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">3 · Payments</h2>
              <p className="text-xs opacity-75 mt-1">
                Stored in{" "}
                <code className="text-[11px]">DeliveryOrderPaymentDetails</code>
                . Optional; record advance or instalment payments here.
              </p>
            </div>

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
              <div className="rounded-lg border border-border overflow-hidden space-y-0">
                {payments.map((p, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-3 border-b border-border last:border-b-0"
                  >
                    <div className="flex flex-wrap items-end gap-3 min-w-0">
                      <div className="grid gap-1 flex-1 basis-[200px] min-w-0">
                        <label className="text-xs font-medium opacity-70">
                          Method
                        </label>
                        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
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

                      <div className="grid gap-1 flex-1 basis-[150px] min-w-0">
                        <label className="text-xs font-medium opacity-70">
                          Date issued
                        </label>
                        <input
                          type="date"
                          className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
                          value={p.paymentDate}
                          disabled={paymentsReadOnly}
                          onChange={(e) =>
                            setPayments((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? { ...x, paymentDate: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </div>

                      {p.method === "CHEQUE" ? (
                        <>
                          <div className="grid gap-1 flex-1 basis-[180px] min-w-0">
                            <label className="text-xs font-medium opacity-70">
                              Cheque no.
                            </label>
                            <input
                              className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
                              placeholder="Cheque no."
                              value={p.chequeNo}
                              disabled={paymentsReadOnly}
                              onChange={(e) =>
                                setPayments((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? { ...x, chequeNo: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-1 flex-1 basis-[180px] min-w-0">
                            <label className="text-xs font-medium opacity-70">
                              Bank
                            </label>
                            <input
                              className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
                              placeholder="Bank"
                              value={p.bank}
                              disabled={paymentsReadOnly}
                              onChange={(e) =>
                                setPayments((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? { ...x, bank: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="grid gap-1 flex-1 basis-[200px] min-w-0">
                            <label className="text-xs font-medium opacity-70">
                              CDC receipt no.
                            </label>
                            <input
                              className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
                              placeholder="CDC receipt no."
                              value={p.cashReceiptNo}
                              disabled={paymentsReadOnly}
                              onChange={(e) =>
                                setPayments((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? { ...x, cashReceiptNo: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </div>
                        </>
                      )}

                      <div className="ml-auto flex justify-end shrink-0 pb-2">
                        <button
                          type="button"
                          className="text-xs underline underline-offset-4 disabled:opacity-40"
                          disabled={paymentsReadOnly}
                          onClick={() =>
                            setPayments((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </section>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={
                busy !== null ||
                draftFormLocked ||
                Boolean(taxPreviewError) ||
                taxPreview == null
              }
              onClick={() => void onSave()}
              className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy === "save"
                ? "Saving…"
                : orderId != null
                  ? "Update delivery order"
                  : "Save delivery order"}
            </button>
            {orderId != null &&
            docStatus === ValidationStatus.PENDING &&
            session &&
            canValidateDO ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void onValidateOrder()}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/25 disabled:opacity-50"
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
