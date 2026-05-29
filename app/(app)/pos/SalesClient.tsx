"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useWorkingPeriod,
  workingMonthDateBounds,
} from "@/contexts/WorkingPeriodContext";
import { utcIsoDateToday } from "@/lib/posting-calendar";
import { useAuth } from "@/contexts/AuthContext";
import { ValidationStatus } from "@/lib/domain";
import type { DeliveryOrderLookupDto } from "@/lib/delivery-order-sale-control";
import { VAT_TAX_CODE } from "@/lib/tax/constants";
import type {
  AvailableDeliveryOrderRow,
  LoadedSaleView,
  PendingSaleRow,
  PosTaxPreviewRow,
  SaleMutationResult,
  SaveSaleResult,
} from "./actions";

type Customer = {
  id: string;
  name: string;
  taxRegimeId: string | null;
  taxRegime: { name: string; vatApplies: boolean } | null;
};

type Product = {
  productId: number;
  productName: string;
};

type Line = {
  productId: string;
  qtyKg: string;
  qtyUnits?: string;
  unitPricePerKg: string;
  unitPricePerUnit?: string;
  storageLocationId: string;
};

type Payment = {
  method: "CASH" | "CHEQUE" | "TRAITE" | "CREDIT";
  amount: string;
  chequeNo?: string;
  bank?: string;
  traiteNo?: string;
  traiteIssuedOn?: string;
  traiteMaturityOn?: string;
};

function parseDec(s: string) {
  const n = Number.parseFloat(String(s ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function trimQtyDisplay(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") || "0";
}

type LineStockHintState = {
  salesBlocked: boolean;
  message: string | null;
  unsellableQty: string;
  sellableQty: string;
};

function aggregatedQtyAtLocation(
  lines: Line[],
  productId: string,
  storageLocationId: string,
): number {
  const key = `${productId}:${storageLocationId}`;
  let total = 0;
  for (const l of lines) {
    if (`${l.productId.trim()}:${l.storageLocationId.trim()}` === key) {
      total += parseDec(l.qtyKg);
    }
  }
  return total;
}

function lineSellableStockFeedback(
  line: Line,
  lines: Line[],
  hints: Record<string, LineStockHintState | undefined>,
): { availableLabel: string | null; exceedMessage: string | null } {
  const pid = line.productId.trim();
  const locId = line.storageLocationId.trim();
  if (!pid || !locId) return { availableLabel: null, exceedMessage: null };
  const hint = hints[`${pid}:${locId}`];
  if (!hint) return { availableLabel: null, exceedMessage: null };
  if (hint.salesBlocked) {
    return { availableLabel: null, exceedMessage: hint.message };
  }
  const available = parseDec(hint.sellableQty);
  const totalAtLocation = aggregatedQtyAtLocation(lines, pid, locId);
  const availableLabel = `Sellable at location: ${hint.sellableQty} kg`;
  if (totalAtLocation > available + 1e-9) {
    return {
      availableLabel,
      exceedMessage: `Total at this location (${trimQtyDisplay(totalAtLocation)} kg) exceeds sellable stock (${hint.sellableQty} kg).`,
    };
  }
  return { availableLabel, exceedMessage: null };
}

function linesFromDeliveryOrderProducts(data: DeliveryOrderLookupDto): Line[] {
  return data.perProduct.map((row) => ({
    productId: String(row.productId),
    qtyKg: "0",
    unitPricePerKg: "0",
    storageLocationId: "",
  }));
}

/** Apply DO lines without wiping qty, location, or resolved prices on customer re-lookup. */
function mergeLinesFromDeliveryOrder(
  prev: Line[],
  data: DeliveryOrderLookupDto,
): Line[] {
  const fromDo = linesFromDeliveryOrderProducts(data);
  const doKey = fromDo.map((l) => l.productId).join(",");
  const prevKey = prev.map((l) => l.productId).join(",");
  if (doKey !== "" && doKey === prevKey) {
    return prev;
  }
  const prevByProduct = new Map(
    prev
      .filter((l) => l.productId.trim() !== "")
      .map((l) => [l.productId, l] as const),
  );
  return fromDo.map((row) => {
    const existing = prevByProduct.get(row.productId);
    if (!existing) return row;
    return {
      ...row,
      qtyKg: existing.qtyKg,
      unitPricePerKg: existing.unitPricePerKg,
      storageLocationId: existing.storageLocationId || row.storageLocationId,
    };
  });
}

function legacyAppliedTaxesFromSale(
  s: LoadedSaleView,
): LoadedSaleView["appliedTaxes"] {
  if (s.appliedTaxes.length > 0) return s.appliedTaxes;
  const v = parseDec(s.vatAmount);
  if (v <= 0) return [];
  const netNum = parseDec(s.netAmount);
  const rate = netNum > 0 ? String(v / netNum) : "0";
  return [{ code: VAT_TAX_CODE, label: "VAT", rate, amount: s.vatAmount }];
}

export function SalesClient(props: {
  customers: Customer[];
  products: Product[];
  salesPoints: Array<{ id: number; name: string }>;
  storageLocations: Array<{
    id: number;
    salesPointId: number;
    name: string;
    isDefault: boolean;
  }>;
  previewPosTaxesAction: (
    customerId: string,
    transactionIso: string,
  ) => Promise<
    { ok: true; taxes: PosTaxPreviewRow[] } | { ok: false; error: string }
  >;
  previewPosLineStockAction: (
    salesPointId: string,
    storageLocationId: string,
    productId: string,
  ) => Promise<
    | {
        ok: true;
        sellableQty: string;
        unsellableQty: string;
        salesBlocked: boolean;
        message: string | null;
      }
    | { ok: false; error: string }
  >;
  saveSaleAction: (formData: FormData) => Promise<SaveSaleResult>;
  loadSaleByInvoiceNo: (invoiceNo: string) => Promise<LoadedSaleView | null>;
  lookupDeliveryOrderAction: (
    deliveryOrderNo: string,
    customerId: string,
  ) => Promise<
    | { ok: true; data: DeliveryOrderLookupDto & { customerMatches: boolean } }
    | { ok: false; error: string }
  >;
  listAvailableDeliveryOrdersAction: (
    salesPointId: string,
  ) => Promise<AvailableDeliveryOrderRow[]>;
  validateSaleAction: (formData: FormData) => Promise<SaleMutationResult>;
  canValidateDocuments: boolean;
  canPickPendingSales: boolean;
  listPendingSalesAction: () => Promise<PendingSaleRow[]>;
  deleteSaleAction: (formData: FormData) => Promise<SaleMutationResult>;
  previewProductUnitPriceAction: (
    customerId: string,
    productId: number,
    dateIso: string,
  ) => Promise<
    { ok: true; unitPriceExTax: string } | { ok: false; error: string }
  >;
  initialLookupNo?: string;
}) {
  const {
    customers,
    products,
    salesPoints,
    previewPosTaxesAction,
    previewPosLineStockAction,
    saveSaleAction,
    loadSaleByInvoiceNo,
    lookupDeliveryOrderAction,
    listAvailableDeliveryOrdersAction,
    validateSaleAction,
    canValidateDocuments: canValidateDocumentsProp,
    canPickPendingSales: canPickPendingSalesProp,
    listPendingSalesAction,
    deleteSaleAction,
    previewProductUnitPriceAction,
    initialLookupNo = "",
  } = props;

  const wp = useWorkingPeriod();
  const router = useRouter();
  const { status: authStatus, session } = useAuth();

  const [saleId, setSaleId] = React.useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = React.useState<string>("");
  const [lookupNo, setLookupNo] = React.useState<string>("");
  const [pendingSales, setPendingSales] = React.useState<PendingSaleRow[]>([]);
  const [pendingPickerOpen, setPendingPickerOpen] = React.useState(false);
  const pendingPickerRef = React.useRef<HTMLDivElement>(null);
  const [soldAtIso, setSoldAtIso] = React.useState<string>("");
  const [referenceNumber, setReferenceNumber] = React.useState<string>("");
  const [vehicleNumber, setVehicleNumber] = React.useState("");
  const [deliveryOrderNo, setDeliveryOrderNo] = React.useState("");
  const [availableDos, setAvailableDos] = React.useState<
    AvailableDeliveryOrderRow[]
  >([]);
  const [doPickerOpen, setDoPickerOpen] = React.useState(false);
  const doPickerRef = React.useRef<HTMLDivElement>(null);
  const [doLookupData, setDoLookupData] = React.useState<
    (DeliveryOrderLookupDto & { customerMatches: boolean }) | null
  >(null);
  const [doLookupError, setDoLookupError] = React.useState<string | null>(null);
  const [doLookupBusy, setDoLookupBusy] = React.useState(false);
  const [salesPointId, setSalesPointId] = React.useState<string>("");
  const effectiveSalesPointId =
    session?.salesPoint?.id != null
      ? String(session.salesPoint.id)
      : salesPointId;

  function locationsForSalesPoint(
    spId: string,
  ): Array<{ id: number; name: string; isDefault: boolean }> {
    const n = Number.parseInt(spId, 10);
    if (!Number.isFinite(n)) return [];
    return props.storageLocations
      .filter((l) => l.salesPointId === n)
      .map((l) => ({ id: l.id, name: l.name, isDefault: l.isDefault }));
  }

  function defaultLocationId(spId: string): string {
    const locs = locationsForSalesPoint(spId);
    const d = locs.find((l) => l.isDefault) ?? locs[0];
    return d ? String(d.id) : "";
  }
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
      storageLocationId: "",
    },
  ]);
  const [payments, setPayments] = React.useState<Payment[]>(() => [
    { method: "CASH", amount: "0" },
  ]);
  const [transactionDate, setTransactionDate] = React.useState(utcIsoDateToday);

  const [taxPreviewRows, setTaxPreviewRows] = React.useState<
    PosTaxPreviewRow[]
  >([]);
  const [taxPreviewError, setTaxPreviewError] = React.useState<string | null>(
    null,
  );
  /** When set, invoice is loaded and tax rows come from server snapshots (not live preview). */
  const [loadedAppliedTaxes, setLoadedAppliedTaxes] = React.useState<
    LoadedSaleView["appliedTaxes"] | null
  >(null);
  const [loadedTotals, setLoadedTotals] = React.useState<{
    netAmount: string;
    grossAmount: string;
  } | null>(null);

  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    invoiceNo: string;
  } | null>(null);
  const [linePriceErrors, setLinePriceErrors] = React.useState<
    Record<number, string>
  >({});
  const [lineStockHints, setLineStockHints] = React.useState<
    Record<
      string,
      {
        salesBlocked: boolean;
        message: string | null;
        unsellableQty: string;
        sellableQty: string;
      }
    >
  >({});

  React.useEffect(() => {
    const sessionSalesPointId = session?.salesPoint?.id;
    if (sessionSalesPointId == null) return;
    let alive = true;
    window.queueMicrotask(() => {
      if (alive) setSalesPointId(String(sessionSalesPointId));
    });
    return () => {
      alive = false;
    };
  }, [session?.salesPoint?.id]);

  React.useEffect(() => {
    if (wp.openFinancialYear == null) return;
    const { minIso, maxIso } = workingMonthDateBounds(
      wp.workingCalendarYear,
      wp.workingCalendarMonth,
    );
    let alive = true;
    window.queueMicrotask(() => {
      if (!alive) return;
      setTransactionDate((prev) => {
        if (prev < minIso) return minIso;
        if (prev > maxIso) return maxIso;
        return prev;
      });
    });
    return () => {
      alive = false;
    };
  }, [wp.openFinancialYear, wp.workingCalendarYear, wp.workingCalendarMonth]);

  React.useEffect(() => {
    if (saleId != null) {
      setAvailableDos([]);
      return;
    }
    if (authStatus !== "ready" || !session) {
      setAvailableDos([]);
      return;
    }
    const spid = effectiveSalesPointId.trim();
    if (!spid) {
      setAvailableDos([]);
      return;
    }
    let alive = true;
    void listAvailableDeliveryOrdersAction(spid).then((rows) => {
      if (!alive) return;
      setAvailableDos(rows);
    });
    return () => {
      alive = false;
    };
  }, [
    authStatus,
    session,
    effectiveSalesPointId,
    saleId,
    listAvailableDeliveryOrdersAction,
  ]);

  React.useEffect(() => {
    if (!doPickerOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!doPickerRef.current) return;
      if (!doPickerRef.current.contains(event.target as Node)) {
        setDoPickerOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDoPickerOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [doPickerOpen]);

  React.useEffect(() => {
    const no = deliveryOrderNo.trim();
    let alive = true;
    const updateLookupState = (fn: () => void) => {
      window.queueMicrotask(() => {
        if (alive) fn();
      });
    };
    if (!no) {
      updateLookupState(() => {
        setDoLookupData(null);
        setDoLookupError(null);
        setDoLookupBusy(false);
      });
      return () => {
        alive = false;
      };
    }
    if (authStatus !== "ready") {
      updateLookupState(() => {
        setDoLookupBusy(false);
        setDoLookupData(null);
        setDoLookupError(null);
      });
      return () => {
        alive = false;
      };
    }
    const actorId = session?.userId?.trim() ?? "";
    if (!actorId) {
      updateLookupState(() => {
        setDoLookupBusy(false);
        setDoLookupData(null);
        setDoLookupError("Login required to check delivery orders.");
      });
      return () => {
        alive = false;
      };
    }
    updateLookupState(() => {
      setDoLookupBusy(true);
      setDoLookupError(null);
    });
    const t = window.setTimeout(() => {
      void lookupDeliveryOrderAction(no, customerId).then((r) => {
        if (!alive) return;
        if (r.ok) {
          setDoLookupData(r.data);
          setDoLookupError(null);
          if (saleId == null) {
            setLines((prev) => mergeLinesFromDeliveryOrder(prev, r.data));
          }
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
  }, [
    authStatus,
    deliveryOrderNo,
    customerId,
    lookupDeliveryOrderAction,
    saleId,
    session?.userId,
  ]);

  React.useEffect(() => {
    if (authStatus !== "ready" || !session || !canPickPendingSalesProp) {
      setPendingSales([]);
      return;
    }
    let alive = true;
    void listPendingSalesAction().then((rows) => {
      if (!alive) return;
      setPendingSales(rows);
    });
    return () => {
      alive = false;
    };
  }, [authStatus, session, canPickPendingSalesProp, listPendingSalesAction]);

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

  React.useEffect(() => {
    let alive = true;
    if (saleId != null) return;
    if (!customerId || authStatus !== "ready" || !session?.userId?.trim()) {
      window.queueMicrotask(() => {
        if (!alive) return;
        setTaxPreviewRows([]);
        setTaxPreviewError(null);
      });
      return () => {
        alive = false;
      };
    }
    void previewPosTaxesAction(customerId, transactionDate).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setTaxPreviewRows(res.taxes);
        setTaxPreviewError(null);
      } else {
        setTaxPreviewRows([]);
        setTaxPreviewError(res.error);
      }
    });
    return () => {
      alive = false;
    };
  }, [
    saleId,
    customerId,
    transactionDate,
    authStatus,
    session?.userId,
    previewPosTaxesAction,
  ]);

  const lineProductKey = lines.map((l) => l.productId).join(",");

  React.useEffect(() => {
    let alive = true;
    if (saleId != null) return;
    const productIdByIdx = lineProductKey.split(",");
    const hasAnyProductPicked = productIdByIdx.some((id) => id.trim() !== "");
    if (!customerId || authStatus !== "ready" || !session?.userId?.trim()) {
      window.queueMicrotask(() => {
        if (!alive) return;
        if (!customerId && hasAnyProductPicked) {
          const hint: Record<number, string> = {};
          productIdByIdx.forEach((id, idx) => {
            if (id.trim() !== "") {
              hint[idx] = "Select a customer first to load the unit price.";
            }
          });
          setLinePriceErrors(hint);
        } else {
          setLinePriceErrors({});
        }
      });
      return () => {
        alive = false;
      };
    }
    window.queueMicrotask(() => {
      if (alive) setLinePriceErrors({});
    });
    void (async () => {
      const errs: Record<number, string> = {};
      const priceByIdx: Record<number, string> = {};
      await Promise.all(
        productIdByIdx.map(async (productIdRaw, idx) => {
          const trimmed = productIdRaw.trim();
          if (trimmed === "") return;
          const pid = Number.parseInt(trimmed, 10);
          if (!Number.isFinite(pid)) return;
          const r = await previewProductUnitPriceAction(
            customerId,
            pid,
            transactionDate,
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
          priceByIdx[i] != null
            ? { ...row, unitPricePerKg: priceByIdx[i]! }
            : row,
        ),
      );
    })();
    return () => {
      alive = false;
    };
  }, [
    saleId,
    customerId,
    transactionDate,
    lineProductKey,
    authStatus,
    session?.userId,
    previewProductUnitPriceAction,
  ]);

  const lineLocationKey = lines
    .map((l) => `${l.productId}:${l.storageLocationId}`)
    .join(",");

  React.useEffect(() => {
    let alive = true;
    if (saleId != null) {
      window.queueMicrotask(() => {
        if (alive) setLineStockHints({});
      });
      return () => {
        alive = false;
      };
    }
    const spid = effectiveSalesPointId.trim();
    if (!spid || authStatus !== "ready") {
      window.queueMicrotask(() => {
        if (alive) setLineStockHints({});
      });
      return () => {
        alive = false;
      };
    }
    const productIds = [
      ...new Set(lines.map((l) => l.productId.trim()).filter(Boolean)),
    ];
    const locs = locationsForSalesPoint(spid);
    if (productIds.length === 0 || locs.length === 0) {
      window.queueMicrotask(() => {
        if (alive) setLineStockHints({});
      });
      return () => {
        alive = false;
      };
    }
    void (async () => {
      const next: typeof lineStockHints = {};
      await Promise.all(
        productIds.flatMap((pid) =>
          locs.map(async (loc) => {
            const r = await previewPosLineStockAction(
              spid,
              String(loc.id),
              pid,
            );
            if (!alive || !r.ok) return;
            next[`${pid}:${loc.id}`] = {
              salesBlocked: r.salesBlocked,
              message: r.message,
              unsellableQty: r.unsellableQty,
              sellableQty: r.sellableQty,
            };
          }),
        ),
      );
      if (!alive) return;
      setLineStockHints(next);
    })();
    return () => {
      alive = false;
    };
  }, [
    authStatus,
    effectiveSalesPointId,
    lineLocationKey,
    lineProductKey,
    saleId,
    previewPosLineStockAction,
  ]);

  const customer = customers.find((c) => c.id === customerId);
  const net = lines.reduce(
    (sum, l) => sum + parseDec(l.qtyKg) * parseDec(l.unitPricePerKg),
    0,
  );

  const taxDisplayRows = React.useMemo(() => {
    if (saleId != null && loadedAppliedTaxes) {
      return loadedAppliedTaxes.map((t) => ({
        key: t.code,
        label: t.label,
        ratePercentLabel: (parseDec(t.rate) * 100).toFixed(2),
        amount: parseDec(t.amount),
      }));
    }
    return taxPreviewRows.map((t) => ({
      key: t.code,
      label: t.label,
      ratePercentLabel: t.ratePercentLabel,
      amount: Math.round(net * parseDec(t.rate) * 100) / 100,
    }));
  }, [saleId, loadedAppliedTaxes, taxPreviewRows, net]);

  const totalTax =
    Math.round(taxDisplayRows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const gross = Math.round((net + totalTax) * 100) / 100;
  const displayNet =
    saleId != null && loadedTotals ? parseDec(loadedTotals.netAmount) : net;
  const displayGross =
    saleId != null && loadedTotals ? parseDec(loadedTotals.grossAmount) : gross;
  const vatChargedHint =
    saleId != null && loadedAppliedTaxes
      ? loadedAppliedTaxes.some(
          (t) => t.code === VAT_TAX_CODE && parseDec(t.amount) > 0,
        )
      : taxPreviewRows.some((t) => t.code === VAT_TAX_CODE);
  const paid = payments.reduce((sum, p) => sum + parseDec(p.amount), 0);

  const transactionDateBounds =
    wp.openFinancialYear != null
      ? workingMonthDateBounds(wp.workingCalendarYear, wp.workingCalendarMonth)
      : null;

  const deliveryOrderControlsItems =
    saleId == null && deliveryOrderNo.trim() !== "" && doLookupData != null;

  const stockSaveBlock = (() => {
    if (saleId != null)
      return { block: false as boolean, hint: null as string | null };
    const totalsByLocation = new Map<string, number>();
    for (const l of lines) {
      const pid = l.productId.trim();
      const locId = l.storageLocationId.trim();
      if (!pid || !locId) continue;
      const hint = lineStockHints[`${pid}:${locId}`];
      if (hint?.salesBlocked) {
        return {
          block: true,
          hint:
            hint.message ??
            "This location holds unsellable stock. Choose another location.",
        };
      }
      const key = `${pid}:${locId}`;
      totalsByLocation.set(
        key,
        (totalsByLocation.get(key) ?? 0) + parseDec(l.qtyKg),
      );
    }
    for (const [key, totalQty] of totalsByLocation) {
      const hint = lineStockHints[key];
      if (!hint) continue;
      const available = parseDec(hint.sellableQty);
      if (totalQty > available + 1e-9) {
        return {
          block: true,
          hint: `Total at this location (${trimQtyDisplay(totalQty)} kg) exceeds sellable stock (${hint.sellableQty} kg).`,
        };
      }
    }
    return { block: false, hint: null };
  })();

  const deliveryOrderSaveBlock = (() => {
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
  })();

  //reset the new sale state to enable creation of a new sale
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
        storageLocationId: defaultLocationId(
          session?.salesPoint ? String(session.salesPoint.id) : "",
        ),
      },
    ]);
    setPayments([{ method: "CASH", amount: "0" }]);
    setTransactionDate(utcIsoDateToday());
    setLoadedAppliedTaxes(null);
    setTaxPreviewRows([]);
    setTaxPreviewError(null);
    setLinePriceErrors({});
    setLineStockHints({});
    setBanner(null);
    setLoadedTotals(null);
  }

  //apply the loaded sale to the state to enable display of the sale details
  function applyLoaded(s: LoadedSaleView, bannerText?: string) {
    setSaleId(s.id);
    setInvoiceNo(s.invoiceNo);
    setLookupNo(s.invoiceNo);
    setSoldAtIso(s.soldAtIso);
    setTransactionDate(
      (s.dateIssuedIso
        ? s.dateIssuedIso.slice(0, 10)
        : s.soldAtIso.slice(0, 10)) || utcIsoDateToday(),
    );
    setReferenceNumber(s.referenceNumber ?? "");
    setVehicleNumber(s.vehicleNumber ?? "");
    setDeliveryOrderNo(s.deliveryOrderNo ?? "");
    setSalesPointId(s.salesPointId != null ? String(s.salesPointId) : "");
    setSaleStatus(s.status);
    setValidatedByName(s.validatedByName ?? "");
    setValidatedAtIso(s.validatedAtIso ?? "");
    setCustomerId(s.customerId);
    setLoadedTotals({ netAmount: s.netAmount, grossAmount: s.grossAmount });
    setLines(
      s.lines.length > 0
        ? s.lines.map((l) => ({
            productId: String(l.productId),
            qtyKg: l.qtyKg,
            qtyUnits: l.qtyUnits ?? l.qtyKg,
            unitPricePerKg: l.unitPricePerKg,
            unitPricePerUnit: l.unitPricePerUnit ?? l.unitPricePerKg,
            storageLocationId:
              l.storageLocationId != null
                ? String(l.storageLocationId)
                : defaultLocationId(String(s.salesPointId ?? "")),
          }))
        : [
            {
              productId: "",
              qtyKg: "0",
              unitPricePerKg: "0",
              storageLocationId: defaultLocationId(
                String(s.salesPointId ?? ""),
              ),
            },
          ],
    );
    setPayments(
      s.payments.length > 0
        ? s.payments.map((p) => ({
            method:
              p.method === "CHEQUE"
                ? "CHEQUE"
                : p.method === "TRAITE"
                  ? "TRAITE"
                  : p.method === "CREDIT"
                    ? "CREDIT"
                    : "CASH",
            amount: p.amount,
            chequeNo: p.chequeNo ?? undefined,
            bank: p.bank ?? undefined,
            traiteNo: p.traiteNo ?? undefined,
            traiteIssuedOn: p.traiteIssuedOn ?? undefined,
            traiteMaturityOn: p.traiteMaturityOn ?? undefined,
          }))
        : [{ method: "CASH", amount: "0" }],
    );
    setLoadedAppliedTaxes(legacyAppliedTaxesFromSale(s));
    setTaxPreviewError(null);
    setLinePriceErrors({});
    setLineStockHints({});
    setBanner({
      type: "ok",
      text: bannerText ?? `Loaded ${s.invoiceNo}.`,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      const data = await loadSaleByInvoiceNo(no);
      if (!data) {
        setBanner({
          type: "error",
          text: "No sale matches that invoice number, or you cannot access it.",
        });
        return;
      }
      setLookupNo(no);
      applyLoaded(data);
    } finally {
      setBusy(null);
    }
  }

  // Optional deep-link: /pos?no=INV-2026-000001
  React.useEffect(() => {
    const no = String(initialLookupNo ?? "").trim();
    if (!no) return;
    setLookupNo(no);
    void onLoadByNo(no);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLookupNo]);

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
      if (!deliveryOrderNo.trim()) {
        setBanner({
          type: "error",
          text: "Delivery Order number is required.",
        });
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
      if (stockSaveBlock.block) {
        setBanner({
          type: "error",
          text: stockSaveBlock.hint ?? "Fix stock availability before saving.",
        });
        return;
      }
      const fd = new FormData();
      fd.set("customerId", customerId);
      fd.set("referenceNumber", referenceNumber);
      fd.set("vehicleNumber", vehicleNumber);
      fd.set("deliveryOrderNo", deliveryOrderNo.trim());
      fd.set(
        "salesPointId",
        session?.salesPoint?.id != null
          ? String(session.salesPoint.id)
          : salesPointId,
      );
      if (lines.some((l) => !String(l.storageLocationId ?? "").trim())) {
        setBanner({
          type: "error",
          text: "Select a storage location on every line.",
        });
        return;
      }
      fd.set(
        "lines",
        JSON.stringify(
          lines.map((l) => ({
            ...l,
            storageLocationId: String(l.storageLocationId),
          })),
        ),
      );
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
        const full = await loadSaleByInvoiceNo(r.invoiceNo);
        if (full) applyLoaded(full, `Created ${r.invoiceNo}.`);
        else {
          setSaleId(r.id);
          setInvoiceNo(r.invoiceNo);
          setLookupNo(r.invoiceNo);
          setSoldAtIso(r.soldAtIso);
          setSaleStatus(ValidationStatus.PENDING);
        }
        setBanner({ type: "ok", text: `Created ${r.invoiceNo}.` });
        router.refresh();
        if (effectiveSalesPointId.trim()) {
          void listAvailableDeliveryOrdersAction(effectiveSalesPointId).then(
            setAvailableDos,
          );
        }
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
    const r = await deleteSaleAction(fd);
    if (!r.ok) {
      setBanner({ type: "error", text: r.error });
      return;
    }
    resetNew();
    setBanner({ type: "ok", text: "Sale deleted." });
    router.refresh();
    if (canPickPendingSalesProp) {
      void listPendingSalesAction().then(setPendingSales);
    }
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
      const r = await validateSaleAction(fd);
      if (r.ok) {
        setBanner({ type: "ok", text: "Invoice validated." });
        router.refresh();
        if (canPickPendingSalesProp) {
          void listPendingSalesAction().then(setPendingSales);
        }
      } else {
        setBanner({ type: "error", text: r.error });
      }
    } finally {
      setBusy(null);
    }
  }

  const canPickPending =
    authStatus === "ready" && session && canPickPendingSalesProp;
  const canPickAvailableDo =
    saleId == null && effectiveSalesPointId.trim() !== "";

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

      <div className="rounded-lg border border-border p-3 sm:p-4">
        <div className="text-sm font-semibold mb-1">Open existing invoice</div>
        <p className="text-xs opacity-75 mb-3">
          Enter the invoice number (e.g. PO-2026-000001) to load the full
          document.
          {canPickPending ? (
            <>
              {" "}
              You can also pick one from the list of invoices awaiting
              validation.
            </>
          ) : null}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="grid gap-1 flex-1 min-w-0">
            <label className="text-xs font-medium opacity-70">
              Invoice no.
            </label>
            <div className="relative" ref={pendingPickerRef}>
              <div className="flex">
                <input
                  className={
                    canPickPending
                      ? "flex-1 rounded-l-md border border-border border-r-0 bg-transparent px-3 py-2 text-sm focus:outline-none"
                      : "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  }
                  value={lookupNo}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLookupNo(next);
                    if (
                      canPickPending &&
                      pendingSales.some((s) => s.invoiceNo === next)
                    ) {
                      void onLoadByNo(next);
                    }
                  }}
                  placeholder="PO-2026-000001"
                />
                {canPickPending ? (
                  <button
                    type="button"
                    aria-label="Pick from invoices awaiting validation"
                    aria-haspopup="listbox"
                    aria-expanded={pendingPickerOpen}
                    title={
                      pendingSales.length === 0
                        ? "No invoices awaiting validation"
                        : `Pick from ${pendingSales.length} pending invoice${pendingSales.length === 1 ? "" : "s"}`
                    }
                    onClick={() => setPendingPickerOpen((v) => !v)}
                    className="rounded-r-md border border-border bg-accent/10 px-3 py-2 text-sm hover:bg-accent/25 focus:outline-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="opacity-70">{pendingSales.length}</span>
                      <span aria-hidden="true">
                        {pendingPickerOpen ? "\u25b4" : "\u25be"}
                      </span>
                    </span>
                  </button>
                ) : null}
              </div>
              {canPickPending && pendingPickerOpen ? (
                <div
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-72 w-full min-w-88 overflow-auto rounded-md border border-border bg-background shadow-lg"
                >
                  {pendingSales.length === 0 ? (
                    <div className="px-3 py-3 text-xs opacity-70">
                      No sales invoices are currently awaiting validation.
                    </div>
                  ) : (
                    <ul className="py-1">
                      {pendingSales.map((s) => (
                        <li key={s.invoiceNo}>
                          <button
                            type="button"
                            role="option"
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-accent/25 focus:bg-accent/25 focus:outline-none"
                            onClick={() => {
                              setLookupNo(s.invoiceNo);
                              setPendingPickerOpen(false);
                              void onLoadByNo(s.invoiceNo);
                            }}
                          >
                            <div className="font-medium tabular-nums">
                              {s.invoiceNo}
                            </div>
                            <div className="text-xs opacity-75">
                              {s.customerName}
                              {" \u00b7 "}
                              {s.soldAtIso}
                              {s.salesPointName
                                ? ` \u00b7 ${s.salesPointName}`
                                : ""}
                              {s.totalLabel ? ` \u00b7 ${s.totalLabel}` : ""}
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
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
            <button
              type="button"
              disabled={busy !== null || !lookupNo.trim()}
              onClick={() => void onLoadByNo()}
              className="rounded-md bg-brand text-brand-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy === "load" ? "Loading…" : "Load"}
            </button>
            <button
              type="button"
              onClick={resetNew}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/25"
            >
              New sale
            </button>
            {saleId ? (
              <Link
                href={`/sales/${saleId}`}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/25"
              >
                View / print
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-border p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
            <h2 className="text-lg font-semibold">Invoice Details</h2>
            <span className="text-xs opacity-75">
              <span className="opacity-70">FY</span>{" "}
              <span className="font-medium tabular-nums">{wp.fyLabel}</span>
              <span className="opacity-50"> · </span>
              <span className="font-medium">{wp.workingMonthLabel}</span>
              <span className="opacity-50"> · </span>
              <span className="opacity-70">Sold</span>{" "}
              <span className="font-medium tabular-nums">
                {soldAtIso
                  ? new Date(soldAtIso)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")
                  : "—"}
              </span>
              <span className="opacity-50"> · </span>
              <span className="opacity-70">Status</span>{" "}
              {saleStatus ? (
                <span
                  className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    saleStatus === ValidationStatus.VALIDATED
                      ? "bg-emerald-600/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                      : saleStatus === ValidationStatus.REJECTED
                        ? "bg-red-600/15 text-red-700 dark:bg-red-500/20 dark:text-red-300"
                        : "bg-amber-500/20 text-amber-800 dark:bg-amber-500/25 dark:text-amber-200"
                  }`}
                >
                  {saleStatus}
                </span>
              ) : (
                <span className="font-medium">—</span>
              )}
              {saleStatus === ValidationStatus.VALIDATED ? (
                <>
                  <span className="opacity-50"> · </span>
                  <span className="opacity-70">by</span>{" "}
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
                </>
              ) : null}
            </span>
          </div>
          {invoiceNo ? (
            <div className="text-sm shrink-0">
              <span className="opacity-70">Invoice</span>{" "}
              <span className="font-semibold tabular-nums">{invoiceNo}</span>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-x-4">
          <div className="grid gap-1">
            <label className="text-xs font-medium opacity-80">Customer</label>
            <select
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={saleId != null}
              required
            >
              <option value="" disabled>
                Select customer
              </option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="text-[11px] opacity-70 leading-tight space-y-0.5">
              <div>
                Regime: {customer?.taxRegime?.name ?? "-"}
                {vatChargedHint ? " · VAT may apply" : ""}
              </div>
              {saleId == null && taxPreviewError ? (
                <div className="text-amber-800 dark:text-amber-300">
                  {taxPreviewError}
                </div>
              ) : null}
              {saleId == null &&
              !taxPreviewError &&
              customerId &&
              taxPreviewRows.length === 0 ? (
                <div>No taxes configured for this regime on this date.</div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium opacity-80">
              Reference no.{" "}
              <span className="font-normal opacity-60">(optional)</span>
            </label>
            <input
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="Voucher / customer ref"
              disabled={saleId != null}
            />
            <p className="text-[11px] opacity-70 leading-tight">
              Printed as reference number.
            </p>
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium opacity-80">
              Sales point
            </label>
            {session?.salesPoint ? (
              <>
                <input
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  value={session.salesPoint.name}
                  readOnly
                />
                <p className="text-[11px] opacity-70 leading-tight">
                  From your login session.
                </p>
              </>
            ) : (
              <>
                <select
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  value={salesPointId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSalesPointId(next);
                    setDeliveryOrderNo("");
                    setDoLookupData(null);
                    setDoLookupError(null);
                    const def = defaultLocationId(next);
                    setLines((prev) =>
                      prev.map((l) => ({
                        ...l,
                        storageLocationId:
                          locationsForSalesPoint(next).some(
                            (loc) => String(loc.id) === l.storageLocationId,
                          ) && l.storageLocationId
                            ? l.storageLocationId
                            : def,
                      })),
                    );
                  }}
                  disabled={saleId != null}
                >
                  <option value="">select sales point</option>
                  {salesPoints.map((sp) => (
                    <option key={sp.id} value={String(sp.id)}>
                      {sp.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] opacity-70 leading-tight">
                  Optional for manager/admin sessions.
                </p>
              </>
            )}
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium opacity-80">Sale date</label>
            <input
              type="date"
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              value={transactionDate}
              min={transactionDateBounds?.minIso}
              max={transactionDateBounds?.maxIso}
              onChange={(e) => setTransactionDate(e.target.value)}
              disabled={saleId != null || wp.openFinancialYear == null}
              required
            />
            <p className="text-[11px] opacity-70 leading-tight">
              Within working month (
              {transactionDateBounds
                ? `${transactionDateBounds.minIso}–${transactionDateBounds.maxIso}`
                : "—"}
              ).
            </p>
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium opacity-80">
              Vehicle number
            </label>
            <input
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="Registration / fleet id"
              disabled={saleId != null}
              required
            />
          </div>
          <div className="grid gap-1">
            <label className="text-xs font-medium opacity-80">
              Delivery order no.
            </label>
            <div className="relative" ref={doPickerRef}>
              <div className="flex">
                <input
                  className={
                    canPickAvailableDo
                      ? "flex-1 rounded-l-md border border-border border-r-0 bg-transparent px-3 py-2 text-sm focus:outline-none"
                      : "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  }
                  value={deliveryOrderNo}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDeliveryOrderNo(next);
                    if (
                      canPickAvailableDo &&
                      availableDos.some((d) => d.deliveryOrderNo === next)
                    ) {
                      setDoPickerOpen(false);
                    }
                  }}
                  placeholder="DO-2026-000001"
                  disabled={saleId != null}
                />
                {canPickAvailableDo ? (
                  <button
                    type="button"
                    aria-label="Pick from delivery orders with balance"
                    aria-haspopup="listbox"
                    aria-expanded={doPickerOpen}
                    title={
                      availableDos.length === 0
                        ? "No delivery orders with balance at this sales point"
                        : `Pick from ${availableDos.length} order${availableDos.length === 1 ? "" : "s"} with balance`
                    }
                    onClick={() => setDoPickerOpen((v) => !v)}
                    disabled={saleId != null}
                    className="rounded-r-md border border-border bg-accent/10 px-3 py-2 text-sm hover:bg-accent/25 focus:outline-none disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="opacity-70">{availableDos.length}</span>
                      <span aria-hidden="true">
                        {doPickerOpen ? "\u25b4" : "\u25be"}
                      </span>
                    </span>
                  </button>
                ) : null}
              </div>
              {canPickAvailableDo && doPickerOpen ? (
                <div
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-72 w-full min-w-88 overflow-auto rounded-md border border-border bg-background shadow-lg"
                >
                  {availableDos.length === 0 ? (
                    <div className="px-3 py-3 text-xs opacity-70">
                      No validated delivery orders with remaining balance at
                      this sales point.
                    </div>
                  ) : (
                    <ul className="py-1">
                      {availableDos.map((d) => (
                        <li key={d.deliveryOrderNo}>
                          <button
                            type="button"
                            role="option"
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-accent/25 focus:bg-accent/25 focus:outline-none"
                            onClick={() => {
                              setDeliveryOrderNo(d.deliveryOrderNo);
                              setDoPickerOpen(false);
                            }}
                          >
                            <div className="font-medium tabular-nums">
                              {d.deliveryOrderNo}
                            </div>
                            <div className="text-xs opacity-75">
                              {d.customerName}
                              {" \u00b7 "}
                              {d.dateIssued}
                              {" \u00b7 "}
                              {d.balanceKg} kg balance
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

          {deliveryOrderNo.trim() ? (
            <div className="rounded-lg border border-border p-3 text-sm space-y-2 sm:col-span-2">
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
                      <span className="font-medium">
                        {doLookupData.customerName}
                      </span>
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
                          <tr className="border-b border-border">
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
                              className="border-b border-border"
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
              className="text-sm underline underline-offset-4 disabled:opacity-50 disabled:no-underline"
              disabled={deliveryOrderControlsItems}
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  {
                    productId: "",
                    qtyKg: "0",
                    unitPricePerKg: "0",
                    storageLocationId: defaultLocationId(effectiveSalesPointId),
                  },
                ])
              }
            >
              Add line
            </button>
          </div>
          <p className="text-xs opacity-70">
            Price / kg (ex tax) is resolved from{" "}
            <Link
              href="/setup/product-pricing"
              className="underline underline-offset-4"
            >
              Product pricing
            </Link>{" "}
            for the transaction date.
          </p>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-border">
              <div className="col-span-4">Product</div>
              <div className="col-span-3">Location</div>
              <div className="col-span-2">Qty (kg)</div>
              <div className="col-span-2">Price / kg (ex tax)</div>
              <div className="col-span-1" />
            </div>
            {lines.map((l, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-start"
              >
                <div className="col-span-4">
                  <select
                    className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                    value={l.productId}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                productId: e.target.value,
                              }
                            : x,
                        ),
                      )
                    }
                    disabled={deliveryOrderControlsItems}
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
                <div className="col-span-3">
                  <select
                    className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                    value={l.storageLocationId}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? { ...x, storageLocationId: e.target.value }
                            : x,
                        ),
                      )
                    }
                    disabled={!effectiveSalesPointId}
                  >
                    <option value="" disabled>
                      Select location
                    </option>
                    {locationsForSalesPoint(effectiveSalesPointId).map(
                      (loc) => {
                        const blocked =
                          l.productId.trim() !== "" &&
                          lineStockHints[`${l.productId}:${loc.id}`]
                            ?.salesBlocked === true;
                        return (
                          <option
                            key={loc.id}
                            value={String(loc.id)}
                            disabled={blocked}
                          >
                            {loc.name}
                            {blocked ? " — unsellable" : ""}
                            {loc.isDefault ? " (default)" : ""}
                          </option>
                        );
                      },
                    )}
                  </select>
                  {(() => {
                    const stockHint =
                      l.productId.trim() && l.storageLocationId.trim()
                        ? lineStockHints[
                            `${l.productId}:${l.storageLocationId}`
                          ]
                        : null;
                    if (!stockHint?.message) return null;
                    return (
                      <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200/90 leading-snug">
                        {stockHint.message}
                      </p>
                    );
                  })()}
                </div>
                <div className="col-span-2">
                  <input
                    className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm tabular-nums"
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
                  {(() => {
                    const qtyFeedback = lineSellableStockFeedback(
                      l,
                      lines,
                      lineStockHints,
                    );
                    if (
                      !qtyFeedback.availableLabel &&
                      !qtyFeedback.exceedMessage
                    ) {
                      return null;
                    }
                    return (
                      <div className="mt-1 space-y-0.5">
                        {qtyFeedback.availableLabel ? (
                          <p className="text-[11px] opacity-70 leading-snug">
                            {qtyFeedback.availableLabel}
                          </p>
                        ) : null}
                        {qtyFeedback.exceedMessage ? (
                          <p className="text-[11px] text-red-700 dark:text-red-300 leading-snug">
                            {qtyFeedback.exceedMessage}
                          </p>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
                <div className="col-span-2 min-w-0">
                  <input
                    className="w-full rounded-md border border-border bg-foreground/6 px-3 py-2 text-sm tabular-nums"
                    value={l.unitPricePerKg}
                    inputMode="decimal"
                    readOnly
                    title="Resolved from product pricing schedules"
                  />
                  {linePriceErrors[idx] ? (
                    <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200/90 leading-snug">
                      {linePriceErrors[idx]}
                    </p>
                  ) : null}
                </div>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    className="text-xs underline underline-offset-4 opacity-80"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== idx))
                    }
                    disabled={lines.length === 1 || deliveryOrderControlsItems}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className="rounded-lg p-4 text-sm">
              <div className="flex justify-between">
                <span className="opacity-70">Net (ex tax)</span>
                <span className="tabular-nums">{displayNet.toFixed(2)}</span>
              </div>
              {taxDisplayRows.map((row) => (
                <div key={row.key} className="flex justify-between">
                  <span className="opacity-70">
                    {row.label} ({row.ratePercentLabel}%)
                  </span>
                  <span className="tabular-nums">{row.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t border-border pt-2 mt-2">
                <span>Gross</span>
                <span className="tabular-nums">{displayGross.toFixed(2)}</span>
              </div>
              <div className="text-xs opacity-70 mt-2">
                Payments total: {paid.toFixed(2)} (must equal gross).
              </div>
            </div>
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

          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 bg-foreground/[0.04]">
              <div className="col-span-3">Method</div>
              <div className="col-span-3">Amount</div>
              <div className="col-span-5">Instrument / bank</div>
              <div className="col-span-1" />
            </div>
            {payments.map((p, idx) => (
              <div key={idx} className="px-3 py-3 space-y-2 text-sm">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <select
                      className="w-full rounded-md border border-border bg-transparent px-2 py-1"
                      value={p.method}
                      onChange={(e) =>
                        setPayments((prev) =>
                          prev.map((x, i) =>
                            i === idx
                              ? {
                                  ...x,
                                  method: e.target.value as Payment["method"],
                                  chequeNo: undefined,
                                  bank: undefined,
                                  traiteNo: undefined,
                                  traiteIssuedOn: undefined,
                                  traiteMaturityOn: undefined,
                                }
                              : x,
                          ),
                        )
                      }
                    >
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="TRAITE">Traite</option>
                      <option value="CREDIT" disabled>
                        Credit
                      </option>
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-2 py-1"
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
                  <div className="col-span-5 text-xs opacity-70 pt-0.5">
                    {p.method === "CHEQUE"
                      ? "Cheque number and drawee bank below."
                      : p.method === "TRAITE"
                        ? "Traite details and bank below."
                        : "No instrument fields for cash."}
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
                {p.method === "CHEQUE" ? (
                  <div className="grid grid-cols-12 gap-2 items-center pl-0 sm:pl-1">
                    <div className="col-span-12 sm:col-span-4">
                      <label className="text-[10px] font-medium opacity-70 block mb-0.5">
                        Cheque #
                      </label>
                      <input
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1"
                        value={p.chequeNo ?? ""}
                        placeholder="Cheque number"
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
                    <div className="col-span-12 sm:col-span-8">
                      <label className="text-[10px] font-medium opacity-70 block mb-0.5">
                        Bank
                      </label>
                      <input
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1"
                        value={p.bank ?? ""}
                        placeholder="Drawee bank"
                        onChange={(e) =>
                          setPayments((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, bank: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}
                {p.method === "TRAITE" ? (
                  <div className="grid grid-cols-12 gap-2 items-end pl-0 sm:pl-1">
                    <div className="col-span-12 sm:col-span-3">
                      <label className="text-[10px] font-medium opacity-70 block mb-0.5">
                        Traite no.
                      </label>
                      <input
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1"
                        value={p.traiteNo ?? ""}
                        placeholder="Traite number"
                        onChange={(e) =>
                          setPayments((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, traiteNo: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <label className="text-[10px] font-medium opacity-70 block mb-0.5">
                        Bank
                      </label>
                      <input
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1"
                        value={p.bank ?? ""}
                        placeholder="Issuing bank"
                        onChange={(e) =>
                          setPayments((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, bank: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <label className="text-[10px] font-medium opacity-70 block mb-0.5">
                        Date issued
                      </label>
                      <input
                        type="date"
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1"
                        value={p.traiteIssuedOn ?? ""}
                        onChange={(e) =>
                          setPayments((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, traiteIssuedOn: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <label className="text-[10px] font-medium opacity-70 block mb-0.5">
                        Maturity
                      </label>
                      <input
                        type="date"
                        className="w-full rounded-md border border-border bg-transparent px-2 py-1"
                        value={p.traiteMaturityOn ?? ""}
                        onChange={(e) =>
                          setPayments((prev) =>
                            prev.map((x, i) =>
                              i === idx
                                ? { ...x, traiteMaturityOn: e.target.value }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* place summary of the payments here */}

        <div className="flex flex-col gap-2">
          {saleId == null &&
          (deliveryOrderSaveBlock.block ||
            stockSaveBlock.block ||
            !vehicleNumber.trim() ||
            Boolean(taxPreviewError)) ? (
            <p className="text-xs text-amber-800 dark:text-amber-300 max-w-xl">
              {taxPreviewError
                ? "Fix tax configuration before saving."
                : !vehicleNumber.trim()
                  ? "Enter a vehicle number before saving."
                  : (stockSaveBlock.hint ??
                    deliveryOrderSaveBlock.hint ??
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
                deliveryOrderSaveBlock.block ||
                stockSaveBlock.block ||
                Boolean(taxPreviewError)
              }
              onClick={() => void onSaveSale()}
              className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy === "save"
                ? "Saving…"
                : saleId != null
                  ? "Loaded (read-only)"
                  : "Save sale (create invoice)"}
            </button>
            {saleId && saleStatus === ValidationStatus.PENDING && session ? (
              canValidateDocumentsProp ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onValidate()}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/25 disabled:opacity-50"
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
