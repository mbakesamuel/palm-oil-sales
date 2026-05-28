"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  STOCK_DOC_STATUS_LABELS,
  STOCK_MOVEMENT_KIND_LABELS,
  stockMovementSign,
} from "@/lib/stock/display";
import { utcIsoDateToday } from "@/lib/posting-calendar";
import type {
  StockDocStatus,
  StockMovementKind,
} from "@prisma/client";
import type {
  AdjustmentListRow,
  ProductOption,
  ReceiptDetail,
  ReceiptListRow,
  SalesPointOption,
  StockBalanceRow,
  StockBootstrap,
  StockMovementRow,
  StorageLocationOption,
  TransferDetail,
  TransferListRow,
} from "./loaders";
import type {
  ReceiptReviewResult,
  StockGenericResult,
  StockMutationResult,
  TransferReviewResult,
} from "./actions";

type TabId = "on-hand" | "movements" | "receipts" | "transfers" | "adjustments";

type Banner = { type: "ok" | "error"; text: string } | null;

const inputClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm";
const selectClass = inputClass;
const labelClass = "text-xs font-medium";
const fieldRowClass = "flex items-start gap-2";
const fieldLabelClass = [
  labelClass,
  "shrink-0 w-[8rem] h-8",
  "flex items-center justify-end px-2",
  "rounded-md border border-border",
  "bg-sidebar text-sidebar-foreground",
].join(" ");
const fieldControlClass = "min-w-0 flex-1";

const TABS: { id: TabId; label: string }[] = [
  { id: "on-hand", label: "On hand" },
  { id: "movements", label: "Movements" },
  { id: "receipts", label: "Receipts" },
  { id: "transfers", label: "Transfers" },
  { id: "adjustments", label: "Adjustments" },
];

function isTabId(raw: string | null | undefined): raw is TabId {
  return (
    raw === "on-hand" ||
    raw === "movements" ||
    raw === "receipts" ||
    raw === "transfers" ||
    raw === "adjustments"
  );
}

function statusBadgeClasses(status: StockDocStatus): string {
  switch (status) {
    case "DRAFT":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40";
    case "POSTED":
    case "RECEIVED":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40";
    case "DISPATCHED":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40";
    case "CANCELLED":
      return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40";
  }
}

function StatusBadge({ status }: { status: StockDocStatus }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
        statusBadgeClasses(status),
      ].join(" ")}
    >
      {STOCK_DOC_STATUS_LABELS[status]}
    </span>
  );
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.length > 10 ? iso.slice(0, 10) : iso;
}

function trimQty(qty: string): string {
  if (!qty.includes(".")) return qty;
  const trimmed = qty.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed || "0";
}

function locationsForSalesPoint(
  storageLocations: StorageLocationOption[],
  salesPointId: string | number,
): StorageLocationOption[] {
  const spId = Number(salesPointId);
  if (!Number.isFinite(spId)) return [];
  return storageLocations.filter((l) => l.salesPointId === spId);
}

function defaultLocationId(
  storageLocations: StorageLocationOption[],
  salesPointId: string | number,
): string {
  const locs = locationsForSalesPoint(storageLocations, salesPointId);
  const d = locs.find((l) => l.isDefault) ?? locs[0];
  return d ? String(d.id) : "";
}

export function StockClient(props: {
  bootstrap: StockBootstrap;
  saveReceiptAction: (formData: FormData) => Promise<StockMutationResult>;
  postReceiptAction: (id: string) => Promise<StockGenericResult>;
  cancelReceiptAction: (id: string) => Promise<StockGenericResult>;
  findReceiptByNumberAction: (receiptNo: string) => Promise<ReceiptReviewResult>;
  loadReceiptForReviewAction: (id: string) => Promise<ReceiptReviewResult>;
  saveTransferAction: (formData: FormData) => Promise<StockMutationResult>;
  dispatchTransferAction: (id: string) => Promise<StockGenericResult>;
  receiveTransferAction: (formData: FormData) => Promise<StockGenericResult>;
  cancelTransferAction: (id: string) => Promise<StockGenericResult>;
  findTransferByNumberAction: (transferNo: string) => Promise<TransferReviewResult>;
  loadTransferForReviewAction: (id: string) => Promise<TransferReviewResult>;
  saveAdjustmentAction: (formData: FormData) => Promise<StockMutationResult>;
  postAdjustmentAction: (id: string) => Promise<StockGenericResult>;
  cancelAdjustmentAction: (id: string) => Promise<StockGenericResult>;
}) {
  const { bootstrap } = props;
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get("tab");
  const tab: TabId = isTabId(tabParam) ? tabParam : "on-hand";
  const [banner, setBanner] = React.useState<Banner>(null);

  function announceOk(text: string) {
    setBanner({ type: "ok", text });
  }
  function announceErr(text: string) {
    setBanner({ type: "error", text });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Stock management</h1>
        <p className="text-sm opacity-75">
          Per sales-point on-hand quantities, receipts, transfers, sales
          deductions, and adjustments. Every operation is recorded with the
          actor and timestamp on the movement ledger.
        </p>
      </header>

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

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setBanner(null);
                router.replace(`/stock?tab=${t.id}`);
              }}
              className={[
                "px-3 py-2 text-sm rounded-t-md border border-b-0",
                tab === t.id
                  ? "border-border bg-background font-medium"
                  : "border-transparent opacity-70 hover:opacity-100",
              ].join(" ")}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>

      {tab === "on-hand" ? (
        <OnHandTab
          salesPoints={bootstrap.salesPoints}
          scopedSalesPointId={bootstrap.scopedSalesPointId}
          rows={bootstrap.onHand}
        />
      ) : null}

      {tab === "movements" ? (
        <MovementsTab
          rows={bootstrap.movements}
          salesPoints={bootstrap.salesPoints}
          scopedSalesPointId={bootstrap.scopedSalesPointId}
        />
      ) : null}

      {tab === "receipts" ? (
        <ReceiptsTab
          rows={bootstrap.receipts}
          salesPoints={bootstrap.salesPoints}
          storageLocations={bootstrap.storageLocations}
          products={bootstrap.products}
          scopedSalesPointId={bootstrap.scopedSalesPointId}
          canPost={bootstrap.canManageReceipts}
          canCancel={bootstrap.canCancelDocuments}
          canDraft={bootstrap.canDraftReceipts}
          saveAction={props.saveReceiptAction}
          postAction={props.postReceiptAction}
          cancelAction={props.cancelReceiptAction}
          findByNumberAction={props.findReceiptByNumberAction}
          loadForReviewAction={props.loadReceiptForReviewAction}
          onOk={(t) => {
            announceOk(t);
            router.refresh();
          }}
          onErr={announceErr}
        />
      ) : null}

      {tab === "transfers" ? (
        <TransfersTab
          rows={bootstrap.transfers}
          salesPoints={bootstrap.salesPoints}
          storageLocations={bootstrap.storageLocations}
          products={bootstrap.products}
          scopedSalesPointId={bootstrap.scopedSalesPointId}
          onHand={bootstrap.onHand}
          canDispatch={bootstrap.canDispatchTransfers}
          canReceive={bootstrap.canReceiveTransfers}
          canCancel={bootstrap.canCancelDocuments}
          canDraft={bootstrap.canDraftTransfers}
          saveAction={props.saveTransferAction}
          dispatchAction={props.dispatchTransferAction}
          receiveAction={props.receiveTransferAction}
          cancelAction={props.cancelTransferAction}
          findByNumberAction={props.findTransferByNumberAction}
          loadForReviewAction={props.loadTransferForReviewAction}
          onOk={(t) => {
            announceOk(t);
            router.refresh();
          }}
          onErr={announceErr}
        />
      ) : null}

      {tab === "adjustments" ? (
        <AdjustmentsTab
          rows={bootstrap.adjustments}
          salesPoints={bootstrap.salesPoints}
          storageLocations={bootstrap.storageLocations}
          products={bootstrap.products}
          onHand={bootstrap.onHand}
          scopedSalesPointId={bootstrap.scopedSalesPointId}
          canPost={bootstrap.canPostAdjustments}
          canReclassify={bootstrap.canReclassifyStock}
          canCancel={bootstrap.canCancelDocuments}
          saveAction={props.saveAdjustmentAction}
          postAction={props.postAdjustmentAction}
          cancelAction={props.cancelAdjustmentAction}
          onOk={(t) => {
            announceOk(t);
            router.refresh();
          }}
          onErr={announceErr}
        />
      ) : null}
    </div>
  );
}

// ============================================================================
// ON HAND
// ============================================================================

function OnHandTab(props: {
  salesPoints: SalesPointOption[];
  scopedSalesPointId: number | null;
  rows: StockBalanceRow[];
}) {
  const { salesPoints, scopedSalesPointId, rows } = props;
  const [salesPointId, setSalesPointId] = React.useState<string>(
    scopedSalesPointId != null ? String(scopedSalesPointId) : "",
  );
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows.filter((r) => {
      if (salesPointId && String(r.salesPointId) !== salesPointId) return false;
      if (
        q &&
        !r.productName.toLowerCase().includes(q) &&
        !r.salesPointName.toLowerCase().includes(q) &&
        !r.storageLocationName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    const grouped = new Map<
      string,
      {
        salesPointId: number;
        salesPointName: string;
        storageLocationId: number;
        storageLocationName: string;
        productId: number;
        productName: string;
        uom: string;
        qty: number;
        sellableQty: number;
        unsellableQty: number;
      }
    >();

    for (const r of base) {
      const key = `${r.salesPointId}:${r.storageLocationId}:${r.productId}`;
      const existing = grouped.get(key);
      const qtyNum = Number.parseFloat(r.qty);
      const qty = Number.isFinite(qtyNum) ? qtyNum : 0;
      const sellableAdd = r.condition === "SELLABLE" ? qty : 0;
      const unsellableAdd = r.condition === "UNSELLABLE" ? qty : 0;
      if (existing) {
        existing.qty += qty;
        existing.sellableQty += sellableAdd;
        existing.unsellableQty += unsellableAdd;
      } else {
        grouped.set(key, {
          salesPointId: r.salesPointId,
          salesPointName: r.salesPointName,
          storageLocationId: r.storageLocationId,
          storageLocationName: r.storageLocationName,
          productId: r.productId,
          productName: r.productName,
          uom: r.uom,
          qty,
          sellableQty: sellableAdd,
          unsellableQty: unsellableAdd,
        });
      }
    }

    return [...grouped.values()].sort((a, b) => {
      const sp = a.salesPointName.localeCompare(b.salesPointName);
      if (sp !== 0) return sp;
      const loc = a.storageLocationName.localeCompare(b.storageLocationName);
      if (loc !== 0) return loc;
      return a.productName.localeCompare(b.productName);
    });
  }, [rows, salesPointId, search]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {scopedSalesPointId == null ? (
          <div className="min-w-[14rem]">
            <label className={labelClass} htmlFor="onhand-sp">
              Sales point
            </label>
            <select
              id="onhand-sp"
              className={selectClass}
              value={salesPointId}
              onChange={(e) => setSalesPointId(e.target.value)}
            >
              <option value="">All</option>
              {salesPoints.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="min-w-[16rem] flex-1">
          <label className={labelClass} htmlFor="onhand-search">
            Search
          </label>
          <input
            id="onhand-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Product or sales point"
            className={inputClass}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm opacity-75">No balances to show.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2 font-medium">Sales point</th>
                <th className="p-2 font-medium">Location</th>
                <th className="p-2 font-medium">Product</th>
                <th className="p-2 font-medium text-right">On hand</th>
                <th className="p-2 font-medium">UOM</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={`${r.salesPointId}-${r.storageLocationId}-${r.productId}`}
                  className={[
                    "border-b border-border align-top",
                    r.unsellableQty > 0 && r.sellableQty <= 0
                      ? "bg-amber-500/5"
                      : "",
                  ].join(" ")}
                >
                  <td className="p-2">{r.salesPointName}</td>
                  <td className="p-2">
                    <div>{r.storageLocationName}</div>
                    {r.unsellableQty > 0 ? (
                      <div className="text-[11px] text-amber-800 dark:text-amber-200/90 mt-0.5">
                        Unsellable stock at this location
                      </div>
                    ) : null}
                  </td>
                  <td className="p-2">{r.productName}</td>
                  <td className="p-2 text-right tabular-nums font-medium">
                    <div>{trimQty(r.qty.toFixed(3))}</div>
                    {r.unsellableQty > 0 ? (
                      <div className="text-[11px] font-normal text-amber-800 dark:text-amber-200/90 mt-0.5">
                        {trimQty(r.unsellableQty.toFixed(3))} unsellable
                        {r.sellableQty > 0
                          ? ` · ${trimQty(r.sellableQty.toFixed(3))} sellable`
                          : " · not available for POS sales"}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-2 opacity-80">{r.uom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs opacity-70">
        Showing {filtered.length} balance{filtered.length === 1 ? "" : "s"}.
      </p>
    </section>
  );
}

// ============================================================================
// MOVEMENTS
// ============================================================================

function MovementsTab(props: {
  rows: StockMovementRow[];
  salesPoints: SalesPointOption[];
  scopedSalesPointId: number | null;
}) {
  const { rows, salesPoints, scopedSalesPointId } = props;
  const [salesPointId, setSalesPointId] = React.useState<string>(
    scopedSalesPointId != null ? String(scopedSalesPointId) : "",
  );
  const [kind, setKind] = React.useState<string>("");
  const [search, setSearch] = React.useState("");

  const displayRows = React.useMemo(() => {
    // Group reclassification pairs into a single display row:
    // - Same adjustment (sourceKind/sourceId), same product + location + sales point + occurredAt,
    // - Both are ADJUSTMENT movements with same qty,
    // - One SELLABLE and one UNSELLABLE,
    // - Notes start with "Reclassify".
    const byKey = new Map<string, StockMovementRow[]>();
    const singles: StockMovementRow[] = [];

    for (const r of rows) {
      const isReclassCandidate =
        r.kind === "ADJUSTMENT" &&
        r.sourceKind === "ADJUSTMENT" &&
        (r.notes ?? "").startsWith("Reclassify ");
      if (!isReclassCandidate) {
        singles.push(r);
        continue;
      }
      const k = [
        r.sourceKind,
        r.sourceId,
        r.salesPointId,
        r.storageLocationId,
        r.productId,
        r.occurredAtIso,
        r.qty,
      ].join("|");
      const arr = byKey.get(k);
      if (arr) arr.push(r);
      else byKey.set(k, [r]);
    }

    const grouped: StockMovementRow[] = [];
    for (const [, pair] of byKey) {
      if (pair.length !== 2) {
        singles.push(...pair);
        continue;
      }
      const a = pair[0]!;
      const b = pair[1]!;
      const conds = new Set([a.condition, b.condition]);
      if (!(conds.has("SELLABLE") && conds.has("UNSELLABLE"))) {
        singles.push(...pair);
        continue;
      }

      const from = a.condition === "SELLABLE" ? a : b;
      const to = a.condition === "UNSELLABLE" ? a : b;
      grouped.push({
        ...from,
        id: `RECLASS:${from.sourceId}:${from.productId}:${from.storageLocationId}:${from.occurredAtIso}:${from.qty}`,
        condition: "SELLABLE" as StockMovementRow["condition"],
        notes:
          from.notes ??
          `Reclassify ${from.condition} -> ${to.condition}`,
      });
    }

    const all = [...singles, ...grouped];
    all.sort((a, b) => {
      const da = Date.parse(a.occurredAtIso);
      const db = Date.parse(b.occurredAtIso);
      if (Number.isFinite(da) && Number.isFinite(db) && da !== db) return db - da;
      const ca = Date.parse(a.createdAtIso);
      const cb = Date.parse(b.createdAtIso);
      if (Number.isFinite(ca) && Number.isFinite(cb) && ca !== cb) return cb - ca;
      return a.id.localeCompare(b.id);
    });
    return all;
  }, [rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return displayRows.filter((r) => {
      if (salesPointId && String(r.salesPointId) !== salesPointId) return false;
      if (kind && r.kind !== kind) return false;
      if (q) {
        const blob =
          `${r.productName} ${r.salesPointName} ${r.storageLocationName} ${r.documentNo ?? ""} ${r.userName}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [displayRows, salesPointId, kind, search]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {scopedSalesPointId == null ? (
          <div className="min-w-[12rem]">
            <label className={labelClass} htmlFor="mv-sp">
              Sales point
            </label>
            <select
              id="mv-sp"
              className={selectClass}
              value={salesPointId}
              onChange={(e) => setSalesPointId(e.target.value)}
            >
              <option value="">All</option>
              {salesPoints.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="min-w-[12rem]">
          <label className={labelClass} htmlFor="mv-kind">
            Kind
          </label>
          <select
            id="mv-kind"
            className={selectClass}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="">All</option>
            {(Object.keys(STOCK_MOVEMENT_KIND_LABELS) as StockMovementKind[]).map((k) => (
              <option key={k} value={k}>
                {STOCK_MOVEMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[16rem] flex-1">
          <label className={labelClass} htmlFor="mv-search">
            Search
          </label>
          <input
            id="mv-search"
            className={inputClass}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Product, sales point, doc#, user"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm opacity-75">No movements match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2 font-medium">When</th>
                <th className="p-2 font-medium">Sales point</th>
                <th className="p-2 font-medium">Location</th>
                <th className="p-2 font-medium">Condition</th>
                <th className="p-2 font-medium">Product</th>
                <th className="p-2 font-medium">Kind</th>
                <th className="p-2 font-medium text-right">Qty</th>
                <th className="p-2 font-medium">Doc #</th>
                <th className="p-2 font-medium">User</th>
                <th className="p-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const sign = stockMovementSign(r.kind);
                return (
                  <tr key={r.id} className="border-b border-border align-top">
                    <td className="p-2 whitespace-nowrap" title={r.createdAtIso}>
                      {formatDateTime(r.occurredAtIso)}
                    </td>
                    <td className="p-2">{r.salesPointName}</td>
                    <td className="p-2">{r.storageLocationName}</td>
                    <td className="p-2 opacity-80">
                      {r.kind === "ADJUSTMENT" && (r.notes ?? "").startsWith("Reclassify ")
                        ? "Sellable→Unsellable"
                        : r.condition === "SELLABLE"
                          ? "Sellable"
                          : "Unsellable"}
                    </td>
                    <td className="p-2">{r.productName}</td>
                    <td className="p-2 whitespace-nowrap">
                      {STOCK_MOVEMENT_KIND_LABELS[r.kind]}
                    </td>
                    <td className="p-2 text-right tabular-nums font-medium">
                      <span
                        className={
                          sign === "-"
                            ? "text-red-700 dark:text-red-300"
                            : sign === "+"
                              ? "text-emerald-700 dark:text-emerald-300"
                              : ""
                        }
                      >
                        {sign === "-" ? "−" : sign === "+" ? "+" : "±"}
                        {trimQty(r.qty)} {r.uom}
                      </span>
                    </td>
                    <td className="p-2 opacity-80">{r.documentNo ?? "—"}</td>
                    <td className="p-2">{r.userName}</td>
                    <td className="p-2 opacity-80">{r.notes ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs opacity-70">
        Showing the latest {filtered.length} movement{filtered.length === 1 ? "" : "s"}
        {filtered.length >= 200 ? " (use filters to narrow further)." : "."}
      </p>
    </section>
  );
}

// ============================================================================
// RECEIPTS
// ============================================================================

type ReceiptLineDraft = {
  productId: string;
  qty: string;
  storageLocationId: string;
};
type TransferLineDraft = {
  productId: string;
  qty: string;
  fromStorageLocationId: string;
};
type AdjustmentLineDraft = {
  productId: string;
  deltaQty: string;
  storageLocationId: string;
  fromCondition?: "SELLABLE" | "UNSELLABLE";
  toCondition?: "SELLABLE" | "UNSELLABLE";
};
type LineDraftRecord = { productId: string; qty: string };

function ReceiptsTab(props: {
  rows: ReceiptListRow[];
  salesPoints: SalesPointOption[];
  storageLocations: StorageLocationOption[];
  products: ProductOption[];
  scopedSalesPointId: number | null;
  canPost: boolean;
  canCancel: boolean;
  canDraft: boolean;
  saveAction: (formData: FormData) => Promise<StockMutationResult>;
  postAction: (id: string) => Promise<StockGenericResult>;
  cancelAction: (id: string) => Promise<StockGenericResult>;
  findByNumberAction: (receiptNo: string) => Promise<ReceiptReviewResult>;
  loadForReviewAction: (id: string) => Promise<ReceiptReviewResult>;
  onOk: (text: string) => void;
  onErr: (text: string) => void;
}) {
  const { rows, salesPoints, storageLocations, products, scopedSalesPointId } = props;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [salesPointId, setSalesPointId] = React.useState<string>(
    scopedSalesPointId != null ? String(scopedSalesPointId) : "",
  );
  const [supplierLabel, setSupplierLabel] = React.useState("");
  const [receivedAt, setReceivedAt] = React.useState(utcIsoDateToday());
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<ReceiptLineDraft[]>(() => [
    {
      productId: "",
      qty: "",
      storageLocationId: defaultLocationId(storageLocations, scopedSalesPointId ?? ""),
    },
  ]);
  const [pendingCancel, setPendingCancel] = React.useState<ReceiptListRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [lookupNo, setLookupNo] = React.useState("");
  const [lookupBusy, setLookupBusy] = React.useState(false);
  const [reviewDetail, setReviewDetail] = React.useState<ReceiptDetail | null>(null);
  const [reviewBusy, setReviewBusy] = React.useState(false);

  function resetForm() {
    setEditingId(null);
    const sp = scopedSalesPointId != null ? String(scopedSalesPointId) : "";
    setSalesPointId(sp);
    setSupplierLabel("");
    setReceivedAt(utcIsoDateToday());
    setNotes("");
    setLines([
      {
        productId: "",
        qty: "",
        storageLocationId: defaultLocationId(storageLocations, sp),
      },
    ]);
  }

  function onSalesPointChange(nextId: string) {
    setSalesPointId(nextId);
    const defLoc = defaultLocationId(storageLocations, nextId);
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        storageLocationId: locationsForSalesPoint(storageLocations, nextId).some(
          (loc) => String(loc.id) === l.storageLocationId,
        )
          ? l.storageLocationId
          : defLoc,
      })),
    );
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      if (editingId) fd.set("id", editingId);
      fd.set("salesPointId", salesPointId);
      fd.set("supplierLabel", supplierLabel);
      fd.set("receivedAt", receivedAt);
      fd.set("notes", notes);
      fd.set(
        "lines",
        JSON.stringify(
          lines
            .filter((l) => l.productId && l.qty && l.storageLocationId)
            .map((l) => ({
              productId: l.productId,
              qty: l.qty,
              storageLocationId: l.storageLocationId,
            })),
        ),
      );
      const res = await props.saveAction(fd);
      if (res.ok) {
        props.onOk(editingId ? `Receipt ${res.documentNo} updated.` : `Receipt ${res.documentNo} drafted.`);
        setOpen(false);
        resetForm();
      } else {
        props.onErr(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onPost(id: string) {
    setBusy(true);
    try {
      const res = await props.postAction(id);
      if (res.ok) {
        props.onOk("Receipt posted; balances updated.");
        if (reviewDetail?.id === id) setReviewDetail(null);
      } else {
        props.onErr(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!pendingCancel) return;
    const id = pendingCancel.id;
    setPendingCancel(null);
    setBusy(true);
    try {
      const res = await props.cancelAction(id);
      if (res.ok) {
        props.onOk("Receipt cancelled.");
        if (reviewDetail?.id === id) setReviewDetail(null);
      } else {
        props.onErr(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function openReviewById(id: string) {
    setReviewBusy(true);
    try {
      const res = await props.loadForReviewAction(id);
      if (res.ok) setReviewDetail(res.detail);
      else props.onErr(res.error);
    } finally {
      setReviewBusy(false);
    }
  }

  function populateFormFromDetail(detail: ReceiptDetail) {
    setEditingId(detail.id);
    setSalesPointId(String(detail.salesPointId));
    setSupplierLabel(detail.supplierLabel);
    setReceivedAt(detail.receivedAtIso.length > 10 ? detail.receivedAtIso.slice(0, 10) : detail.receivedAtIso);
    setNotes(detail.notes ?? "");
    setLines(
      detail.lines.length > 0
        ? detail.lines.map((l) => ({
            productId: String(l.productId),
            qty: l.qty,
            storageLocationId: String(l.storageLocationId),
          }))
        : [
            {
              productId: "",
              qty: "",
              storageLocationId: defaultLocationId(storageLocations, detail.salesPointId),
            },
          ],
    );
    setOpen(true);
  }

  async function openEditById(id: string) {
    setReviewBusy(true);
    try {
      const res = await props.loadForReviewAction(id);
      if (res.ok) {
        if (res.detail.status !== "DRAFT") {
          props.onErr("Only draft receipts can be edited.");
          return;
        }
        setReviewDetail(null);
        populateFormFromDetail(res.detail);
      } else {
        props.onErr(res.error);
      }
    } finally {
      setReviewBusy(false);
    }
  }

  async function onLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lookupBusy) return;
    const n = lookupNo.trim();
    if (!n) return;
    setLookupBusy(true);
    try {
      const res = await props.findByNumberAction(n);
      if (res.ok) {
        setReviewDetail(res.detail);
        setLookupNo("");
      } else {
        props.onErr(res.error);
      }
    } finally {
      setLookupBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Stock receipts</h2>
          {props.canPost ? (
            <p className="text-xs opacity-70">
              Pull a draft voucher by its number to cross-check the lines
              before posting.
            </p>
          ) : (
            <p className="text-xs opacity-70">
              Draft a receipt, then print the voucher and submit it to your
              supervisor for posting.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.canPost ? (
            <form
              onSubmit={onLookup}
              className="flex items-center gap-1.5"
              aria-label="Pull voucher by number"
            >
              <input
                value={lookupNo}
                onChange={(e) => setLookupNo(e.target.value)}
                placeholder="SR-2026-000001"
                className={[inputClass, "w-44 font-mono"].join(" ")}
                aria-label="Receipt number"
              />
              <button
                type="submit"
                disabled={lookupBusy || !lookupNo.trim()}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent/25 disabled:opacity-50"
              >
                {lookupBusy ? "…" : "Pull voucher"}
              </button>
            </form>
          ) : null}
          {props.canDraft ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-brand text-brand-foreground px-3 py-2 text-sm font-medium"
            >
              New receipt
            </button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm opacity-75">No receipts recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2 font-medium">Receipt #</th>
                <th className="p-2 font-medium">Date</th>
                <th className="p-2 font-medium">Sales point</th>
                <th className="p-2 font-medium">Supplier</th>
                <th className="p-2 font-medium text-right">Lines</th>
                <th className="p-2 font-medium text-right">Total qty</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Created by</th>
                <th className="p-2 font-medium">Posted by</th>
                <th className="p-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border align-top">
                  <td className="p-2 font-mono text-xs">{r.receiptNo}</td>
                  <td className="p-2 whitespace-nowrap">{formatDate(r.receivedAtIso)}</td>
                  <td className="p-2">{r.salesPointName}</td>
                  <td className="p-2">{r.supplierLabel}</td>
                  <td className="p-2 text-right tabular-nums">{r.lineCount}</td>
                  <td className="p-2 text-right tabular-nums">{trimQty(r.totalQty)}</td>
                  <td className="p-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-2 opacity-80">
                    <div>{r.createdByName}</div>
                    <div className="text-[11px] opacity-70">{formatDateTime(r.createdAtIso)}</div>
                  </td>
                  <td className="p-2 opacity-80">
                    {r.postedByName ? (
                      <>
                        <div>{r.postedByName}</div>
                        <div className="text-[11px] opacity-70">{formatDateTime(r.postedAtIso)}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-1.5 flex-wrap">
                      <button
                        type="button"
                        disabled={reviewBusy}
                        onClick={() => void openReviewById(r.id)}
                        className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent/25 disabled:opacity-50"
                        title="View lines"
                      >
                        Review
                      </button>
                      <a
                        href={`/stock/receipts/${r.id}/print`}
                        className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent/25"
                        title="Print voucher"
                      >
                        Print
                      </a>
                      {r.status === "DRAFT" ? (
                        <button
                          type="button"
                          disabled={busy || reviewBusy}
                          onClick={() => void openEditById(r.id)}
                          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent/25 disabled:opacity-50"
                          title="Correct draft"
                        >
                          Edit
                        </button>
                      ) : null}
                      {r.status === "DRAFT" && props.canPost ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onPost(r.id)}
                          className="rounded-md bg-brand text-brand-foreground px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                        >
                          Post
                        </button>
                      ) : null}
                      {(r.status === "DRAFT" || (r.status === "POSTED" && props.canCancel)) ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setPendingCancel(r)}
                          className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-2.5 py-1 text-xs hover:bg-red-600/10 disabled:opacity-50"
                        >
                          {r.status === "DRAFT" ? "Delete" : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewDetail ? (
        <ReceiptReviewDialog
          detail={reviewDetail}
          canPost={props.canPost}
          canCancel={props.canCancel}
          busy={busy || reviewBusy}
          onClose={() => setReviewDetail(null)}
          onPost={() => void onPost(reviewDetail.id)}
          onEdit={() => void openEditById(reviewDetail.id)}
          onCancel={() => setPendingCancel(reviewDetail)}
        />
      ) : null}

      {open ? (
        <DocDialog
          title={editingId ? "Edit receipt" : "New receipt"}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={(e) => void onSave(e)} className="space-y-2.5">
            {scopedSalesPointId == null ? (
              <div className={fieldRowClass}>
                <label className={fieldLabelClass}>Sales point</label>
                <div className={fieldControlClass}>
                  <select
                    className={selectClass}
                    value={salesPointId}
                    onChange={(e) => onSalesPointChange(e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {salesPoints.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <input type="hidden" value={salesPointId} readOnly name="salesPointId" />
            )}
            <div className={fieldRowClass}>
              <label className={fieldLabelClass}>Received on</label>
              <div className={fieldControlClass}>
                <input
                  type="date"
                  className={inputClass}
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className={fieldRowClass}>
              <label className={fieldLabelClass}>Supplier label</label>
              <div className={fieldControlClass}>
                <input
                  className={inputClass}
                  value={supplierLabel}
                  onChange={(e) => setSupplierLabel(e.target.value)}
                  placeholder="e.g. Mill A — Truck B-123"
                  required
                />
              </div>
            </div>
            <div className={fieldRowClass}>
              <label className={fieldLabelClass}>Notes</label>
              <div className={fieldControlClass}>
                <input
                  className={inputClass}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <ReceiptLineEditor
              products={products}
              lines={lines}
              onChange={setLines}
              locationOptions={locationsForSalesPoint(storageLocations, salesPointId)}
              defaultLocationId={defaultLocationId(storageLocations, salesPointId)}
            />

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 pl-[8rem]">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {editingId ? "Save changes" : "Create draft"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </DocDialog>
      ) : null}

      {pendingCancel ? (
        <ConfirmDialog
          title={pendingCancel.status === "DRAFT" ? "Delete this receipt?" : "Cancel posted receipt?"}
          description={
            pendingCancel.status === "DRAFT"
              ? `Draft receipt ${pendingCancel.receiptNo} will be removed.`
              : `Receipt ${pendingCancel.receiptNo} is already posted. Cancelling will write compensating movements that reverse every line. This cannot be undone.`
          }
          confirmLabel={pendingCancel.status === "DRAFT" ? "Delete" : "Cancel receipt"}
          onCancel={() => setPendingCancel(null)}
          onConfirm={onCancel}
        />
      ) : null}
    </section>
  );
}

// ============================================================================
// TRANSFERS
// ============================================================================

function TransfersTab(props: {
  rows: TransferListRow[];
  salesPoints: SalesPointOption[];
  storageLocations: StorageLocationOption[];
  products: ProductOption[];
  onHand: StockBalanceRow[];
  scopedSalesPointId: number | null;
  canDispatch: boolean;
  canReceive: boolean;
  canCancel: boolean;
  canDraft: boolean;
  saveAction: (formData: FormData) => Promise<StockMutationResult>;
  dispatchAction: (id: string) => Promise<StockGenericResult>;
  receiveAction: (formData: FormData) => Promise<StockGenericResult>;
  cancelAction: (id: string) => Promise<StockGenericResult>;
  findByNumberAction: (transferNo: string) => Promise<TransferReviewResult>;
  loadForReviewAction: (id: string) => Promise<TransferReviewResult>;
  onOk: (text: string) => void;
  onErr: (text: string) => void;
}) {
  const { rows, salesPoints, storageLocations, products, onHand, scopedSalesPointId } = props;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [fromSalesPointId, setFromSalesPointId] = React.useState<string>(
    scopedSalesPointId != null ? String(scopedSalesPointId) : "",
  );
  const [toSalesPointId, setToSalesPointId] = React.useState<string>("");
  const [dispatchedAt, setDispatchedAt] = React.useState(utcIsoDateToday());
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<TransferLineDraft[]>(() => [
    {
      productId: "",
      qty: "",
      fromStorageLocationId: defaultLocationId(storageLocations, scopedSalesPointId ?? ""),
    },
  ]);
  const [pendingCancel, setPendingCancel] = React.useState<TransferListRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [lookupNo, setLookupNo] = React.useState("");
  const [lookupBusy, setLookupBusy] = React.useState(false);
  const [reviewDetail, setReviewDetail] = React.useState<TransferDetail | null>(null);
  const [reviewBusy, setReviewBusy] = React.useState(false);
  const [receiveDetail, setReceiveDetail] = React.useState<TransferDetail | null>(null);
  const [receiveLines, setReceiveLines] = React.useState<
    { lineId: string; toStorageLocationId: string }[]
  >([]);

  function resetForm() {
    setEditingId(null);
    const from = scopedSalesPointId != null ? String(scopedSalesPointId) : "";
    setFromSalesPointId(from);
    setToSalesPointId("");
    setDispatchedAt(utcIsoDateToday());
    setNotes("");
    setLines([
      {
        productId: "",
        qty: "",
        fromStorageLocationId: defaultLocationId(storageLocations, from),
      },
    ]);
  }

  function onFromSalesPointChange(nextId: string) {
    setFromSalesPointId(nextId);
    const defFrom = defaultLocationId(storageLocations, nextId);
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        fromStorageLocationId: locationsForSalesPoint(storageLocations, nextId).some(
          (loc) => String(loc.id) === l.fromStorageLocationId,
        )
          ? l.fromStorageLocationId
          : defFrom,
      })),
    );
  }

  function openReceiveDialog(detail: TransferDetail) {
    setReceiveDetail(detail);
    setReceiveLines(
      detail.lines.map((l) => ({
        lineId: l.id,
        toStorageLocationId: defaultLocationId(storageLocations, detail.toSalesPointId),
      })),
    );
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      if (editingId) fd.set("id", editingId);
      fd.set("fromSalesPointId", fromSalesPointId);
      fd.set("toSalesPointId", toSalesPointId);
      fd.set("dispatchedAt", dispatchedAt);
      fd.set("notes", notes);
      fd.set(
        "lines",
        JSON.stringify(
          lines
            .filter(
              (l) =>
                l.productId &&
                l.qty &&
                l.fromStorageLocationId,
            )
            .map((l) => ({
              productId: l.productId,
              qty: l.qty,
              fromStorageLocationId: l.fromStorageLocationId,
            })),
        ),
      );
      const res = await props.saveAction(fd);
      if (res.ok) {
        props.onOk(editingId ? `Transfer ${res.documentNo} updated.` : `Transfer ${res.documentNo} drafted.`);
        setOpen(false);
        resetForm();
      } else {
        props.onErr(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onDispatch(id: string) {
    setBusy(true);
    try {
      const res = await props.dispatchAction(id);
      if (res.ok) {
        props.onOk("Transfer dispatched; source balance updated.");
        if (reviewDetail?.id === id) setReviewDetail(null);
      } else {
        props.onErr(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function openReceiveById(id: string) {
    setReviewBusy(true);
    try {
      const res = await props.loadForReviewAction(id);
      if (res.ok) openReceiveDialog(res.detail);
      else props.onErr(res.error);
    } finally {
      setReviewBusy(false);
    }
  }

  async function onReceiveSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!receiveDetail || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("transferId", receiveDetail.id);
      fd.set("lines", JSON.stringify(receiveLines));
      const res = await props.receiveAction(fd);
      if (res.ok) {
        props.onOk("Transfer received; destination balance updated.");
        setReceiveDetail(null);
        if (reviewDetail?.id === receiveDetail.id) setReviewDetail(null);
      } else {
        props.onErr(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onCancelTransfer() {
    if (!pendingCancel) return;
    const id = pendingCancel.id;
    setPendingCancel(null);
    setBusy(true);
    try {
      const res = await props.cancelAction(id);
      if (res.ok) {
        props.onOk("Transfer cancelled.");
        if (reviewDetail?.id === id) setReviewDetail(null);
      } else {
        props.onErr(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function openReviewById(id: string) {
    setReviewBusy(true);
    try {
      const res = await props.loadForReviewAction(id);
      if (res.ok) setReviewDetail(res.detail);
      else props.onErr(res.error);
    } finally {
      setReviewBusy(false);
    }
  }

  function populateFormFromDetail(detail: TransferDetail) {
    setEditingId(detail.id);
    setFromSalesPointId(String(detail.fromSalesPointId));
    setToSalesPointId(String(detail.toSalesPointId));
    setDispatchedAt(
      detail.dispatchedAtIso
        ? detail.dispatchedAtIso.length > 10
          ? detail.dispatchedAtIso.slice(0, 10)
          : detail.dispatchedAtIso
        : utcIsoDateToday(),
    );
    setNotes(detail.notes ?? "");
    setLines(
      detail.lines.length > 0
        ? detail.lines.map((l) => ({
            productId: String(l.productId),
            qty: l.qty,
            fromStorageLocationId: String(l.fromStorageLocationId),
          }))
        : [
            {
              productId: "",
              qty: "",
              fromStorageLocationId: defaultLocationId(
                storageLocations,
                detail.fromSalesPointId,
              ),
            },
          ],
    );
    setOpen(true);
  }

  async function openEditById(id: string) {
    setReviewBusy(true);
    try {
      const res = await props.loadForReviewAction(id);
      if (res.ok) {
        if (res.detail.status !== "DRAFT") {
          props.onErr("Only draft transfers can be edited.");
          return;
        }
        setReviewDetail(null);
        populateFormFromDetail(res.detail);
      } else {
        props.onErr(res.error);
      }
    } finally {
      setReviewBusy(false);
    }
  }

  async function onLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lookupBusy) return;
    const n = lookupNo.trim();
    if (!n) return;
    setLookupBusy(true);
    try {
      const res = await props.findByNumberAction(n);
      if (res.ok) {
        setReviewDetail(res.detail);
        setLookupNo("");
      } else {
        props.onErr(res.error);
      }
    } finally {
      setLookupBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Stock transfers</h2>
          {props.canDispatch ? (
            <p className="text-xs opacity-70">
              Pull a draft voucher by its number to cross-check the lines
              before dispatching.
            </p>
          ) : (
            <p className="text-xs opacity-70">
              Draft a transfer, then print the voucher and submit it to your
              supervisor for dispatch.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {props.canDispatch ? (
            <form
              onSubmit={onLookup}
              className="flex items-center gap-1.5"
              aria-label="Pull voucher by number"
            >
              <input
                value={lookupNo}
                onChange={(e) => setLookupNo(e.target.value)}
                placeholder="ST-2026-000001"
                className={[inputClass, "w-44 font-mono"].join(" ")}
                aria-label="Transfer number"
              />
              <button
                type="submit"
                disabled={lookupBusy || !lookupNo.trim()}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent/25 disabled:opacity-50"
              >
                {lookupBusy ? "…" : "Pull voucher"}
              </button>
            </form>
          ) : null}
          {props.canDraft ? (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-md bg-brand text-brand-foreground px-3 py-2 text-sm font-medium"
            >
              New transfer
            </button>
          ) : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm opacity-75">No transfers recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2 font-medium">Transfer #</th>
                <th className="p-2 font-medium">From</th>
                <th className="p-2 font-medium">To</th>
                <th className="p-2 font-medium">Dispatched</th>
                <th className="p-2 font-medium">Received</th>
                <th className="p-2 font-medium text-right">Lines</th>
                <th className="p-2 font-medium text-right">Total qty</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Created by</th>
                <th className="p-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSourceUser =
                  scopedSalesPointId == null || scopedSalesPointId === r.fromSalesPointId;
                const isDestUser =
                  scopedSalesPointId == null || scopedSalesPointId === r.toSalesPointId;
                return (
                  <tr key={r.id} className="border-b border-border align-top">
                    <td className="p-2 font-mono text-xs">{r.transferNo}</td>
                    <td className="p-2">{r.fromSalesPointName}</td>
                    <td className="p-2">{r.toSalesPointName}</td>
                    <td className="p-2 whitespace-nowrap">
                      {r.dispatchedAtIso ? formatDate(r.dispatchedAtIso) : "—"}
                      {r.dispatchedByName ? (
                        <div className="text-[11px] opacity-70">by {r.dispatchedByName}</div>
                      ) : null}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {r.receivedAtIso ? formatDate(r.receivedAtIso) : "—"}
                      {r.receivedByName ? (
                        <div className="text-[11px] opacity-70">by {r.receivedByName}</div>
                      ) : null}
                    </td>
                    <td className="p-2 text-right tabular-nums">{r.lineCount}</td>
                    <td className="p-2 text-right tabular-nums">{trimQty(r.totalQty)}</td>
                    <td className="p-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-2 opacity-80">
                      <div>{r.createdByName}</div>
                      <div className="text-[11px] opacity-70">{formatDateTime(r.createdAtIso)}</div>
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          disabled={reviewBusy}
                          onClick={() => void openReviewById(r.id)}
                          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent/25 disabled:opacity-50"
                          title="View lines"
                        >
                          Review
                        </button>
                        <a
                          href={`/stock/transfers/${r.id}/print`}
                          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent/25"
                          title="Print voucher"
                        >
                          Print
                        </a>
                        {r.status === "DRAFT" && isSourceUser ? (
                          <button
                            type="button"
                            disabled={busy || reviewBusy}
                            onClick={() => void openEditById(r.id)}
                            className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent/25 disabled:opacity-50"
                            title="Correct draft"
                          >
                            Edit
                          </button>
                        ) : null}
                        {r.status === "DRAFT" && props.canDispatch && isSourceUser ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => onDispatch(r.id)}
                            className="rounded-md bg-brand text-brand-foreground px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                          >
                            Dispatch
                          </button>
                        ) : null}
                        {r.status === "DISPATCHED" && props.canReceive && isDestUser ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void openReceiveById(r.id)}
                            className="rounded-md bg-brand text-brand-foreground px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                          >
                            Receive
                          </button>
                        ) : null}
                        {(r.status === "DRAFT" ||
                          ((r.status === "DISPATCHED" || r.status === "RECEIVED") && props.canCancel)) ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setPendingCancel(r)}
                            className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-2.5 py-1 text-xs hover:bg-red-600/10 disabled:opacity-50"
                          >
                            {r.status === "DRAFT" ? "Delete" : "Cancel"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <DocDialog
          title={editingId ? "Edit transfer" : "New transfer"}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={(e) => void onSave(e)} className="space-y-2.5">
            <div className={fieldRowClass}>
              <label className={fieldLabelClass}>From</label>
              <div className={fieldControlClass}>
                <select
                  className={selectClass}
                  value={fromSalesPointId}
                  onChange={(e) => onFromSalesPointChange(e.target.value)}
                  required
                  disabled={scopedSalesPointId != null}
                >
                  <option value="">Select…</option>
                  {salesPoints.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className={fieldRowClass}>
              <label className={fieldLabelClass}>To</label>
              <div className={fieldControlClass}>
                <select
                  className={selectClass}
                  value={toSalesPointId}
                  onChange={(e) => setToSalesPointId(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {salesPoints
                    .filter((sp) => String(sp.id) !== fromSalesPointId)
                    .map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className={fieldRowClass}>
              <label className={fieldLabelClass}>Dispatch date</label>
              <div className={fieldControlClass}>
                <input
                  type="date"
                  className={inputClass}
                  value={dispatchedAt}
                  onChange={(e) => setDispatchedAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className={fieldRowClass}>
              <label className={fieldLabelClass}>Notes</label>
              <div className={fieldControlClass}>
                <input
                  className={inputClass}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <TransferLineEditor
              products={products}
              lines={lines}
              onChange={setLines}
              fromSalesPointId={fromSalesPointId}
              onHand={onHand}
              fromLocationOptions={locationsForSalesPoint(storageLocations, fromSalesPointId)}
              defaultFromLocationId={defaultLocationId(storageLocations, fromSalesPointId)}
            />

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 pl-[8rem]">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {editingId ? "Save changes" : "Create draft"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </DocDialog>
      ) : null}

      {pendingCancel ? (
        <ConfirmDialog
          title={pendingCancel.status === "DRAFT" ? "Delete this transfer?" : "Cancel transfer?"}
          description={
            pendingCancel.status === "DRAFT"
              ? `Draft transfer ${pendingCancel.transferNo} will be removed.`
              : `Transfer ${pendingCancel.transferNo} is ${STOCK_DOC_STATUS_LABELS[pendingCancel.status].toLowerCase()}. Cancelling writes compensating movements to reverse every line.`
          }
          confirmLabel={pendingCancel.status === "DRAFT" ? "Delete" : "Cancel transfer"}
          onCancel={() => setPendingCancel(null)}
          onConfirm={onCancelTransfer}
        />
      ) : null}

      {reviewDetail ? (
        <TransferReviewDialog
          detail={reviewDetail}
          scopedSalesPointId={scopedSalesPointId}
          canDispatch={props.canDispatch}
          canReceive={props.canReceive}
          canCancel={props.canCancel}
          busy={busy || reviewBusy}
          onClose={() => setReviewDetail(null)}
          onDispatch={() => void onDispatch(reviewDetail.id)}
          onReceive={() => openReceiveDialog(reviewDetail)}
          onEdit={() => void openEditById(reviewDetail.id)}
          onCancel={() => setPendingCancel(reviewDetail)}
        />
      ) : null}

      {receiveDetail ? (
        <ReceiveTransferDialog
          detail={receiveDetail}
          storageLocations={storageLocations}
          receiveLines={receiveLines}
          onReceiveLinesChange={setReceiveLines}
          busy={busy}
          onClose={() => setReceiveDetail(null)}
          onSubmit={onReceiveSubmit}
        />
      ) : null}
    </section>
  );
}

// ============================================================================
// ADJUSTMENTS
// ============================================================================

function AdjustmentsTab(props: {
  rows: AdjustmentListRow[];
  salesPoints: SalesPointOption[];
  storageLocations: StorageLocationOption[];
  products: ProductOption[];
  onHand: StockBalanceRow[];
  scopedSalesPointId: number | null;
  canPost: boolean;
  canReclassify: boolean;
  canCancel: boolean;
  saveAction: (formData: FormData) => Promise<StockMutationResult>;
  postAction: (id: string) => Promise<StockGenericResult>;
  cancelAction: (id: string) => Promise<StockGenericResult>;
  onOk: (text: string) => void;
  onErr: (text: string) => void;
}) {
  const { rows, salesPoints, storageLocations, products, onHand, scopedSalesPointId } = props;
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [salesPointId, setSalesPointId] = React.useState<string>(
    scopedSalesPointId != null ? String(scopedSalesPointId) : "",
  );
  const [reason, setReason] = React.useState("");
  const [mode, setMode] = React.useState<"ADJUST" | "RECLASSIFY">("ADJUST");
  const [occurredAt, setOccurredAt] = React.useState(utcIsoDateToday());
  const [lines, setLines] = React.useState<AdjustmentLineDraft[]>(() => [
    {
      productId: "",
      deltaQty: "",
      storageLocationId: defaultLocationId(storageLocations, scopedSalesPointId ?? ""),
      fromCondition: "SELLABLE",
      toCondition: "UNSELLABLE",
    },
  ]);
  const [pendingCancel, setPendingCancel] = React.useState<AdjustmentListRow | null>(null);
  const [busy, setBusy] = React.useState(false);

  function resetForm() {
    setEditingId(null);
    const sp = scopedSalesPointId != null ? String(scopedSalesPointId) : "";
    setSalesPointId(sp);
    setReason("");
    setMode("ADJUST");
    setOccurredAt(utcIsoDateToday());
    setLines([
      {
        productId: "",
        deltaQty: "",
        storageLocationId: defaultLocationId(storageLocations, sp),
        fromCondition: "SELLABLE",
        toCondition: "UNSELLABLE",
      },
    ]);
  }

  function onSalesPointChange(nextId: string) {
    setSalesPointId(nextId);
    const defLoc = defaultLocationId(storageLocations, nextId);
    setLines((prev) =>
      prev.map((l) => ({
        ...l,
        storageLocationId: locationsForSalesPoint(storageLocations, nextId).some(
          (loc) => String(loc.id) === l.storageLocationId,
        )
          ? l.storageLocationId
          : defLoc,
      })),
    );
  }

  function openCreate() {
    resetForm();
    setOpen(true);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      if (editingId) fd.set("id", editingId);
      fd.set("salesPointId", salesPointId);
      fd.set("reason", reason);
      fd.set("occurredAt", occurredAt);
      fd.set(
        "lines",
        JSON.stringify(
          lines
            .filter((l) => l.productId && l.deltaQty && l.storageLocationId)
            .map((l) => ({
              productId: l.productId,
              deltaQty: l.deltaQty,
              storageLocationId: l.storageLocationId,
              ...(mode === "RECLASSIFY" && props.canReclassify
                ? { fromCondition: l.fromCondition ?? "SELLABLE", toCondition: l.toCondition ?? "UNSELLABLE" }
                : {}),
            })),
        ),
      );
      const res = await props.saveAction(fd);
      if (res.ok) {
        props.onOk(editingId ? `Adjustment ${res.documentNo} updated.` : `Adjustment ${res.documentNo} drafted.`);
        setOpen(false);
        resetForm();
      } else {
        props.onErr(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onPost(id: string) {
    setBusy(true);
    try {
      const res = await props.postAction(id);
      if (res.ok) props.onOk("Adjustment posted; balances updated.");
      else props.onErr(res.error);
    } finally {
      setBusy(false);
    }
  }

  async function onCancel() {
    if (!pendingCancel) return;
    const id = pendingCancel.id;
    setPendingCancel(null);
    setBusy(true);
    try {
      const res = await props.cancelAction(id);
      if (res.ok) props.onOk("Adjustment cancelled.");
      else props.onErr(res.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Stock adjustments</h2>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-brand text-brand-foreground px-3 py-2 text-sm font-medium"
        >
          New adjustment
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm opacity-75">No adjustments recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2 font-medium">Adjustment #</th>
                <th className="p-2 font-medium">Date</th>
                <th className="p-2 font-medium">Sales point</th>
                <th className="p-2 font-medium">Reason</th>
                <th className="p-2 font-medium text-right">Lines</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Created by</th>
                <th className="p-2 font-medium">Posted by</th>
                <th className="p-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border align-top">
                  <td className="p-2 font-mono text-xs">{r.adjustmentNo}</td>
                  <td className="p-2 whitespace-nowrap">{formatDate(r.occurredAtIso)}</td>
                  <td className="p-2">{r.salesPointName}</td>
                  <td className="p-2">{r.reason}</td>
                  <td className="p-2 text-right tabular-nums">{r.lineCount}</td>
                  <td className="p-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-2 opacity-80">
                    <div>{r.createdByName}</div>
                    <div className="text-[11px] opacity-70">{formatDateTime(r.createdAtIso)}</div>
                  </td>
                  <td className="p-2 opacity-80">
                    {r.postedByName ? (
                      <>
                        <div>{r.postedByName}</div>
                        <div className="text-[11px] opacity-70">{formatDateTime(r.postedAtIso)}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex justify-end gap-1.5 flex-wrap">
                      {r.status === "DRAFT" && props.canPost ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onPost(r.id)}
                          className="rounded-md bg-brand text-brand-foreground px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                        >
                          Post
                        </button>
                      ) : null}
                      {(r.status === "DRAFT" || (r.status === "POSTED" && props.canCancel)) ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setPendingCancel(r)}
                          className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-2.5 py-1 text-xs hover:bg-red-600/10 disabled:opacity-50"
                        >
                          {r.status === "DRAFT" ? "Delete" : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <DocDialog
          title={editingId ? "Edit adjustment" : "New adjustment"}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={(e) => void onSave(e)} className="space-y-2.5">
            {scopedSalesPointId == null ? (
              <div className={fieldRowClass}>
                <label className={fieldLabelClass}>Sales point</label>
                <div className={fieldControlClass}>
                  <select
                    className={selectClass}
                    value={salesPointId}
                    onChange={(e) => onSalesPointChange(e.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {salesPoints.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            <div className={fieldRowClass}>
              <label className={fieldLabelClass}>Date</label>
              <div className={fieldControlClass}>
                <input
                  type="date"
                  className={inputClass}
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className={fieldRowClass}>
              <label className={fieldLabelClass}>Reason</label>
              <div className={fieldControlClass}>
                <input
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. monthly inventory count"
                  required
                />
              </div>
            </div>

            <div className={fieldRowClass}>
              <label className={fieldLabelClass}>Mode</label>
              <div className={fieldControlClass}>
                {props.canReclassify ? (
                  <>
                    <select
                      className={selectClass}
                      value={mode}
                      onChange={(e) => setMode(e.target.value as "ADJUST" | "RECLASSIFY")}
                    >
                      <option value="ADJUST">Adjust (+/-)</option>
                      <option value="RECLASSIFY">Reclassify sellable ↔ unsellable</option>
                    </select>
                    <p className="text-[11px] opacity-70 mt-1">
                      Reclassify moves quantity between sellable and unsellable within the same
                      location. Managers only.
                    </p>
                  </>
                ) : (
                  <p className="text-sm opacity-80">Adjust (+/-) quantity at a storage location.</p>
                )}
              </div>
            </div>

            <AdjustmentLineEditor
              products={products}
              lines={lines}
              onChange={setLines}
              locationOptions={locationsForSalesPoint(storageLocations, salesPointId)}
              defaultLocationId={defaultLocationId(storageLocations, salesPointId)}
              mode={mode}
              onHand={onHand}
              salesPointId={salesPointId}
            />

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 pl-[8rem]">
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {editingId ? "Save changes" : "Create draft"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </DocDialog>
      ) : null}

      {pendingCancel ? (
        <ConfirmDialog
          title={pendingCancel.status === "DRAFT" ? "Delete this adjustment?" : "Cancel posted adjustment?"}
          description={
            pendingCancel.status === "DRAFT"
              ? `Draft adjustment ${pendingCancel.adjustmentNo} will be removed.`
              : `Adjustment ${pendingCancel.adjustmentNo} is posted. Cancelling writes compensating movements that reverse every line.`
          }
          confirmLabel={pendingCancel.status === "DRAFT" ? "Delete" : "Cancel adjustment"}
          onCancel={() => setPendingCancel(null)}
          onConfirm={onCancel}
        />
      ) : null}
    </section>
  );
}

// ============================================================================
// SHARED — modal shell + line editor
// ============================================================================

function DocDialog(props: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
      onKeyDown={(e) => {
        if (e.key === "Escape") props.onClose();
      }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={props.onClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-background text-foreground p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="text-sm font-semibold">{props.title}</div>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs"
            onClick={props.onClose}
          >
            X
          </button>
        </div>
        <div className="max-h-[min(40rem,calc(100vh-8rem))] overflow-y-auto pr-1">
          {props.children}
        </div>
      </div>
    </div>
  );
}

function ReceiptLineEditor(props: {
  products: ProductOption[];
  lines: ReceiptLineDraft[];
  onChange: (next: ReceiptLineDraft[]) => void;
  locationOptions: StorageLocationOption[];
  defaultLocationId: string;
}) {
  const { products, lines, onChange, locationOptions, defaultLocationId: defLoc } = props;

  function update(idx: number, patch: Partial<ReceiptLineDraft>) {
    onChange(
      lines.map((l, i) => (i === idx ? ({ ...l, ...patch } as ReceiptLineDraft) : l)),
    );
  }

  function add() {
    onChange([
      ...lines,
      { productId: "", qty: "", storageLocationId: defLoc },
    ]);
  }

  function remove(idx: number) {
    onChange(
      lines.length === 1
        ? [{ productId: "", qty: "", storageLocationId: defLoc }]
        : lines.filter((_, i) => i !== idx),
    );
  }

  return (
    <div className="rounded-md border border-border p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">Lines</div>
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/25"
        >
          + Add line
        </button>
      </div>
      <div className="space-y-1.5">
        {lines.map((l, idx) => {
          const product = products.find((p) => String(p.productId) === l.productId);
          const uom = product?.uom ?? "";
          return (
            <div
              key={idx}
              className="grid grid-cols-[1fr_10rem_7rem_3rem_2rem] gap-1.5 items-center"
            >
              <select
                className={selectClass}
                value={l.productId}
                onChange={(e) => update(idx, { productId: e.target.value })}
                aria-label="Product"
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.productName}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={l.storageLocationId}
                onChange={(e) => update(idx, { storageLocationId: e.target.value })}
                aria-label="Storage location"
                required
              >
                <option value="">Location…</option>
                {locationOptions.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                    {loc.isSellable ? "" : " (unsellable)"}
                    {loc.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                min="0"
                className={inputClass}
                value={l.qty}
                onChange={(e) => update(idx, { qty: e.target.value })}
                aria-label="Quantity"
                placeholder="Qty"
              />
              <span className="text-xs opacity-70">{uom}</span>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-md border border-border h-8 text-xs hover:bg-red-600/10"
                aria-label="Remove line"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {locationOptions.length === 0 ? (
        <p className="text-[11px] text-amber-700 dark:text-amber-300">
          Add storage locations for this sales point under Sales points.
        </p>
      ) : null}
    </div>
  );
}

function transferAvailableQty(
  onHand: StockBalanceRow[],
  fromSalesPointId: string,
  fromStorageLocationId: string,
  productId: string,
): string {
  if (!fromSalesPointId || !fromStorageLocationId || !productId) return "0";
  const row = onHand.find(
    (r) =>
      String(r.salesPointId) === fromSalesPointId &&
      String(r.storageLocationId) === fromStorageLocationId &&
      String(r.productId) === productId,
  );
  return row?.qty ?? "0";
}

function TransferLineEditor(props: {
  products: ProductOption[];
  lines: TransferLineDraft[];
  onChange: (next: TransferLineDraft[]) => void;
  fromSalesPointId: string;
  onHand: StockBalanceRow[];
  fromLocationOptions: StorageLocationOption[];
  defaultFromLocationId: string;
}) {
  const {
    products,
    lines,
    onChange,
    fromSalesPointId,
    onHand,
    fromLocationOptions,
    defaultFromLocationId: defFrom,
  } = props;

  function update(idx: number, patch: Partial<TransferLineDraft>) {
    onChange(
      lines.map((l, i) => (i === idx ? ({ ...l, ...patch } as TransferLineDraft) : l)),
    );
  }

  function add() {
    onChange([
      ...lines,
      {
        productId: "",
        qty: "",
        fromStorageLocationId: defFrom,
      },
    ]);
  }

  function remove(idx: number) {
    onChange(
      lines.length === 1
        ? [
            {
              productId: "",
              qty: "",
              fromStorageLocationId: defFrom,
            },
          ]
        : lines.filter((_, i) => i !== idx),
    );
  }

  return (
    <div className="rounded-md border border-border p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">Lines</div>
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/25"
        >
          + Add line
        </button>
      </div>
      <div className="space-y-2">
        {lines.map((l, idx) => {
          const product = products.find((p) => String(p.productId) === l.productId);
          const uom = product?.uom ?? "";
          const availableStr = transferAvailableQty(
            onHand,
            fromSalesPointId,
            l.fromStorageLocationId,
            l.productId,
          );
          const availableNum = Number.parseFloat(availableStr);
          const qtyNum = Number.parseFloat(l.qty);
          const overAvailable =
            l.productId &&
            l.fromStorageLocationId &&
            l.qty &&
            Number.isFinite(qtyNum) &&
            Number.isFinite(availableNum) &&
            qtyNum > availableNum;
          return (
            <div key={idx} className="space-y-0.5">
              <div
                className="grid grid-cols-[1fr_8rem_6rem_3rem_2rem] gap-1.5 items-center"
              >
                <select
                  className={selectClass}
                  value={l.productId}
                  onChange={(e) => update(idx, { productId: e.target.value })}
                  aria-label="Product"
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.productName}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={l.fromStorageLocationId}
                  onChange={(e) => update(idx, { fromStorageLocationId: e.target.value })}
                  aria-label="From location"
                >
                  <option value="">From…</option>
                  {fromLocationOptions.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.isSellable ? "" : " (unsellable)"}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className={[
                    inputClass,
                    overAvailable ? "border-red-600/60 focus:border-red-600" : "",
                  ].join(" ")}
                  value={l.qty}
                  onChange={(e) => update(idx, { qty: e.target.value })}
                  aria-label="Quantity"
                />
                <span className="text-xs opacity-70">{uom}</span>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="rounded-md border border-border h-8 text-xs hover:bg-red-600/10"
                  aria-label="Remove line"
                >
                  ×
                </button>
              </div>
              {l.productId && l.fromStorageLocationId ? (
                <p
                  className={[
                    "text-[11px] pl-0.5",
                    overAvailable
                      ? "text-red-700 dark:text-red-300"
                      : "opacity-70",
                  ].join(" ")}
                >
                  Available at source: {trimQty(availableStr)} {uom}
                  {overAvailable ? " — exceeds available stock" : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdjustmentLineEditor(props: {
  products: ProductOption[];
  lines: AdjustmentLineDraft[];
  onChange: (next: AdjustmentLineDraft[]) => void;
  locationOptions: StorageLocationOption[];
  defaultLocationId: string;
  mode: "ADJUST" | "RECLASSIFY";
  onHand: StockBalanceRow[];
  salesPointId: string;
}) {
  const {
    products,
    lines,
    onChange,
    locationOptions,
    defaultLocationId: defLoc,
    mode,
    onHand,
    salesPointId,
  } = props;

  function update(idx: number, patch: Partial<AdjustmentLineDraft>) {
    onChange(
      lines.map((l, i) => (i === idx ? ({ ...l, ...patch } as AdjustmentLineDraft) : l)),
    );
  }

  function add() {
    onChange([
      ...lines,
      {
        productId: "",
        deltaQty: "",
        storageLocationId: defLoc,
        fromCondition: "SELLABLE",
        toCondition: "UNSELLABLE",
      },
    ]);
  }

  function remove(idx: number) {
    onChange(
      lines.length === 1
        ? [
            {
              productId: "",
              deltaQty: "",
              storageLocationId: defLoc,
              fromCondition: "SELLABLE",
              toCondition: "UNSELLABLE",
            },
          ]
        : lines.filter((_, i) => i !== idx),
    );
  }

  return (
    <div className="rounded-md border border-border p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">Lines</div>
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/25"
        >
          + Add line
        </button>
      </div>
      <div className="space-y-1.5">
        {lines.map((l, idx) => {
          const product = products.find((p) => String(p.productId) === l.productId);
          const uom = product?.uom ?? "";
          const spIdNum = Number.parseInt(salesPointId, 10);
          const locIdNum = Number.parseInt(l.storageLocationId, 10);
          const productIdNum = Number.parseInt(l.productId, 10);
          const fromCond = l.fromCondition ?? "SELLABLE";
          const availableStr =
            mode === "RECLASSIFY" &&
            Number.isFinite(spIdNum) &&
            Number.isFinite(locIdNum) &&
            Number.isFinite(productIdNum)
              ? (onHand.find(
                  (r) =>
                    r.salesPointId === spIdNum &&
                    r.storageLocationId === locIdNum &&
                    r.productId === productIdNum &&
                    r.condition === fromCond,
                )?.qty ?? "0")
              : null;
          const availableNum =
            availableStr != null ? Number.parseFloat(String(availableStr)) : NaN;
          const qtyNum = Number.parseFloat(l.deltaQty);
          const overAvailable =
            mode === "RECLASSIFY" &&
            availableStr != null &&
            l.deltaQty &&
            Number.isFinite(qtyNum) &&
            Number.isFinite(availableNum) &&
            qtyNum > availableNum;
          return (
            <div
              key={idx}
              className="space-y-0.5"
            >
              <div
                className={
                  mode === "RECLASSIFY"
                    ? "grid grid-cols-[1fr_10rem_7rem_8rem_8rem_3rem_2rem] gap-1.5 items-center"
                    : "grid grid-cols-[1fr_10rem_7rem_3rem_2rem] gap-1.5 items-center"
                }
              >
                <select
                  className={selectClass}
                  value={l.productId}
                  onChange={(e) => update(idx, { productId: e.target.value })}
                  aria-label="Product"
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.productName}
                    </option>
                  ))}
                </select>
                <select
                  className={selectClass}
                  value={l.storageLocationId}
                  onChange={(e) => update(idx, { storageLocationId: e.target.value })}
                  aria-label="Storage location"
                >
                  <option value="">Location…</option>
                  {locationOptions.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.isDefault ? " (default)" : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  className={[
                    inputClass,
                    overAvailable ? "border-red-600/60 focus:border-red-600" : "",
                  ].join(" ")}
                  value={l.deltaQty}
                  onChange={(e) => update(idx, { deltaQty: e.target.value })}
                  aria-label="Delta"
                  placeholder={mode === "RECLASSIFY" ? "Qty" : "± qty"}
                />
                {mode === "RECLASSIFY" ? (
                  <>
                    <select
                      className={selectClass}
                      value={l.fromCondition ?? "SELLABLE"}
                      onChange={(e) =>
                        update(idx, {
                          fromCondition: e.target.value as "SELLABLE" | "UNSELLABLE",
                        })
                      }
                      aria-label="From condition"
                    >
                      <option value="SELLABLE">Sellable</option>
                      <option value="UNSELLABLE">Unsellable</option>
                    </select>
                    <select
                      className={selectClass}
                      value={l.toCondition ?? "UNSELLABLE"}
                      onChange={(e) =>
                        update(idx, {
                          toCondition: e.target.value as "SELLABLE" | "UNSELLABLE",
                        })
                      }
                      aria-label="To condition"
                    >
                      <option value="UNSELLABLE">Unsellable</option>
                      <option value="SELLABLE">Sellable</option>
                    </select>
                  </>
                ) : null}
                <span className="text-xs opacity-70">{uom}</span>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="rounded-md border border-border h-8 text-xs hover:bg-red-600/10"
                  aria-label="Remove line"
                >
                  ×
                </button>
              </div>

              {mode === "RECLASSIFY" && availableStr != null && l.productId && l.storageLocationId ? (
                <p
                  className={[
                    "text-[11px] pl-0.5",
                    overAvailable ? "text-red-700 dark:text-red-300" : "opacity-70",
                  ].join(" ")}
                >
                  Available ({fromCond === "SELLABLE" ? "sellable" : "unsellable"}): {trimQty(availableStr)} {uom}
                  {overAvailable ? " — exceeds available stock" : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] opacity-70">
        {mode === "RECLASSIFY"
          ? "Quantity to move (must be > 0). Posts -qty from From and +qty to To."
          : "Delta (+ gain / − loss)"}
      </p>
    </div>
  );
}

function LineEditor<T extends LineDraftRecord>(props: {
  products: ProductOption[];
  lines: T[];
  onChange: (next: T[]) => void;
  qtyKey: keyof T & string;
  qtyLabel: string;
  allowNegativeQty?: boolean;
}) {
  const { products, lines, onChange, qtyKey, qtyLabel, allowNegativeQty } = props;

  function update(idx: number, patch: Partial<T>) {
    onChange(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function emptyLine(): T {
    return { productId: "", [qtyKey]: "" } as unknown as T;
  }

  function add() {
    onChange([...lines, emptyLine()]);
  }

  function remove(idx: number) {
    onChange(lines.length === 1 ? [emptyLine()] : lines.filter((_, i) => i !== idx));
  }

  return (
    <div className="rounded-md border border-border p-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold">Lines</div>
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/25"
        >
          + Add line
        </button>
      </div>
      <div className="space-y-1.5">
        {lines.map((l, idx) => {
          const product = products.find((p) => String(p.productId) === l.productId);
          const uom = product?.uom ?? "";
          return (
            <div
              key={idx}
              className="grid grid-cols-[1fr_8rem_3rem_2rem] gap-1.5 items-center"
            >
              <select
                className={selectClass}
                value={l.productId}
                onChange={(e) =>
                  update(idx, { productId: e.target.value } as unknown as Partial<T>)
                }
                aria-label="Product"
              >
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.productName}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                min={allowNegativeQty ? undefined : "0"}
                className={inputClass}
                value={String(l[qtyKey] ?? "")}
                onChange={(e) =>
                  update(idx, { [qtyKey]: e.target.value } as unknown as Partial<T>)
                }
                aria-label={qtyLabel}
                placeholder={qtyLabel}
              />
              <span className="text-xs opacity-70">{uom}</span>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-md border border-border h-8 text-xs hover:bg-red-600/10"
                aria-label="Remove line"
                title="Remove line"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] opacity-70">{qtyLabel}</p>
    </div>
  );
}

// ============================================================================
// REVIEW DIALOGS — supervisors pull a draft voucher by number, cross-check the
// line items, then act on it (post / dispatch / receive / cancel). Clerks can
// also "Review" any document to see its lines, but the action buttons are
// hidden unless they hold the matching permission.
// ============================================================================

function ReviewLineTable(props: {
  lines: {
    productName: string;
    uom: string;
    qty: string;
    deltaQty?: string;
    storageLocationName?: string;
    fromStorageLocationName?: string;
    toStorageLocationName?: string | null;
  }[];
  qtyHeader?: string;
}) {
  const { lines, qtyHeader = "Quantity" } = props;
  const showLocation = lines.some((l) => l.storageLocationName);
  const showTransferLocations = lines.some(
    (l) => l.fromStorageLocationName || l.toStorageLocationName,
  );
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left bg-accent/15">
            <th className="p-2 font-medium w-8">#</th>
            <th className="p-2 font-medium">Product</th>
            {showLocation ? <th className="p-2 font-medium">Location</th> : null}
            {showTransferLocations ? (
              <>
                <th className="p-2 font-medium">From</th>
                <th className="p-2 font-medium">To</th>
              </>
            ) : null}
            <th className="p-2 font-medium w-16">UOM</th>
            <th className="p-2 font-medium text-right w-28">{qtyHeader}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, idx) => (
            <tr key={idx} className="border-b border-border last:border-b-0">
              <td className="p-2 tabular-nums opacity-70">{idx + 1}</td>
              <td className="p-2 font-medium">{l.productName}</td>
              {showLocation ? (
                <td className="p-2 opacity-80">{l.storageLocationName ?? "—"}</td>
              ) : null}
              {showTransferLocations ? (
                <>
                  <td className="p-2 opacity-80">{l.fromStorageLocationName ?? "—"}</td>
                  <td className="p-2 opacity-80">
                    {l.toStorageLocationName ?? "Pending receipt"}
                  </td>
                </>
              ) : null}
              <td className="p-2 opacity-80">{l.uom}</td>
              <td className="p-2 text-right tabular-nums font-medium">
                {trimQty(l.deltaQty ?? l.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewKeyValue(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-xs uppercase tracking-wide opacity-60 w-32 shrink-0">
        {props.label}
      </span>
      <span className="text-sm">{props.children}</span>
    </div>
  );
}

function ReceiptReviewDialog(props: {
  detail: ReceiptDetail;
  canPost: boolean;
  canCancel: boolean;
  busy: boolean;
  onClose: () => void;
  onPost: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { detail, canPost, canCancel, busy } = props;
  const isDraft = detail.status === "DRAFT";
  return (
    <DocDialog
      title={`Review receipt ${detail.receiptNo}`}
      onClose={props.onClose}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={detail.status} />
          <a
            href={`/stock/receipts/${detail.id}/print`}
            className="text-xs underline underline-offset-4 opacity-80 hover:opacity-100"
          >
            Open printable voucher
          </a>
        </div>

        <div className="space-y-1.5">
          <ReviewKeyValue label="Sales point">{detail.salesPointName}</ReviewKeyValue>
          <ReviewKeyValue label="Received on">{formatDate(detail.receivedAtIso)}</ReviewKeyValue>
          <ReviewKeyValue label="Supplier">{detail.supplierLabel}</ReviewKeyValue>
          <ReviewKeyValue label="Drafted by">
            {detail.createdByName}
            <span className="opacity-60 ml-2">{formatDateTime(detail.createdAtIso)}</span>
          </ReviewKeyValue>
          {detail.postedByName ? (
            <ReviewKeyValue label="Posted by">
              {detail.postedByName}
              <span className="opacity-60 ml-2">{formatDateTime(detail.postedAtIso)}</span>
            </ReviewKeyValue>
          ) : null}
          {detail.notes ? (
            <ReviewKeyValue label="Notes">{detail.notes}</ReviewKeyValue>
          ) : null}
        </div>

        <ReviewLineTable lines={detail.lines} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
          >
            Close
          </button>
          {(isDraft || (detail.status === "POSTED" && canCancel)) ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onCancel}
              className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10 disabled:opacity-50"
            >
              {isDraft ? "Delete draft" : "Cancel receipt"}
            </button>
          ) : null}
          {isDraft ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onEdit}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25 disabled:opacity-50"
              title="Correct the draft before posting"
            >
              Edit draft
            </button>
          ) : null}
          {isDraft && canPost ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onPost}
              className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Post receipt
            </button>
          ) : null}
        </div>
      </div>
    </DocDialog>
  );
}

function ReceiveTransferDialog(props: {
  detail: TransferDetail;
  storageLocations: StorageLocationOption[];
  receiveLines: { lineId: string; toStorageLocationId: string }[];
  onReceiveLinesChange: (
    next: { lineId: string; toStorageLocationId: string }[],
  ) => void;
  busy: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { detail, storageLocations, receiveLines, onReceiveLinesChange, busy } = props;
  const toLocationOptions = locationsForSalesPoint(storageLocations, detail.toSalesPointId);

  function updateLine(lineId: string, toStorageLocationId: string) {
    onReceiveLinesChange(
      receiveLines.map((l) =>
        l.lineId === lineId ? { ...l, toStorageLocationId } : l,
      ),
    );
  }

  return (
    <DocDialog
      title={`Receive transfer ${detail.transferNo}`}
      onClose={props.onClose}
    >
      <form onSubmit={props.onSubmit} className="space-y-4">
        <p className="text-xs opacity-80">
          Choose where each line should be stored at {detail.toSalesPointName}.
        </p>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left bg-accent/15">
                <th className="p-2 font-medium">Product</th>
                <th className="p-2 font-medium">From</th>
                <th className="p-2 font-medium text-right w-24">Qty</th>
                <th className="p-2 font-medium">Receive into</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line) => {
                const receiveLine = receiveLines.find((l) => l.lineId === line.id);
                return (
                  <tr key={line.id} className="border-b border-border last:border-b-0">
                    <td className="p-2 font-medium">{line.productName}</td>
                    <td className="p-2 opacity-80">{line.fromStorageLocationName ?? "—"}</td>
                    <td className="p-2 text-right tabular-nums">
                      {trimQty(line.qty)} {line.uom}
                    </td>
                    <td className="p-2">
                      <select
                        className={selectClass}
                        value={receiveLine?.toStorageLocationId ?? ""}
                        onChange={(e) => updateLine(line.id, e.target.value)}
                        required
                        aria-label={`Receive ${line.productName} into`}
                      >
                        <option value="">Select location…</option>
                        {toLocationOptions.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                            {loc.isSellable ? "" : " (unsellable)"}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={props.onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Confirm receipt
          </button>
        </div>
      </form>
    </DocDialog>
  );
}

function TransferReviewDialog(props: {
  detail: TransferDetail;
  scopedSalesPointId: number | null;
  canDispatch: boolean;
  canReceive: boolean;
  canCancel: boolean;
  busy: boolean;
  onClose: () => void;
  onDispatch: () => void;
  onReceive: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const { detail, scopedSalesPointId, canDispatch, canReceive, canCancel, busy } = props;
  const isSourceUser =
    scopedSalesPointId == null || scopedSalesPointId === detail.fromSalesPointId;
  const isDestUser =
    scopedSalesPointId == null || scopedSalesPointId === detail.toSalesPointId;
  const isDraft = detail.status === "DRAFT";
  const isDispatched = detail.status === "DISPATCHED";
  const isReceived = detail.status === "RECEIVED";
  return (
    <DocDialog
      title={`Review transfer ${detail.transferNo}`}
      onClose={props.onClose}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={detail.status} />
          <a
            href={`/stock/transfers/${detail.id}/print`}
            className="text-xs underline underline-offset-4 opacity-80 hover:opacity-100"
          >
            Open printable voucher
          </a>
        </div>

        <div className="space-y-1.5">
          <ReviewKeyValue label="From">{detail.fromSalesPointName}</ReviewKeyValue>
          <ReviewKeyValue label="To">{detail.toSalesPointName}</ReviewKeyValue>
          <ReviewKeyValue label="Dispatched">
            {detail.dispatchedAtIso ? formatDate(detail.dispatchedAtIso) : "—"}
            {detail.dispatchedByName ? (
              <span className="opacity-60 ml-2">by {detail.dispatchedByName}</span>
            ) : null}
          </ReviewKeyValue>
          <ReviewKeyValue label="Received">
            {detail.receivedAtIso ? formatDate(detail.receivedAtIso) : "—"}
            {detail.receivedByName ? (
              <span className="opacity-60 ml-2">by {detail.receivedByName}</span>
            ) : null}
          </ReviewKeyValue>
          <ReviewKeyValue label="Drafted by">
            {detail.createdByName}
            <span className="opacity-60 ml-2">{formatDateTime(detail.createdAtIso)}</span>
          </ReviewKeyValue>
          {detail.notes ? (
            <ReviewKeyValue label="Notes">{detail.notes}</ReviewKeyValue>
          ) : null}
        </div>

        <ReviewLineTable lines={detail.lines} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
          >
            Close
          </button>
          {(isDraft || ((isDispatched || isReceived) && canCancel)) ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onCancel}
              className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10 disabled:opacity-50"
            >
              {isDraft ? "Delete draft" : "Cancel transfer"}
            </button>
          ) : null}
          {isDraft && isSourceUser ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onEdit}
              className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25 disabled:opacity-50"
              title="Correct the draft before dispatching"
            >
              Edit draft
            </button>
          ) : null}
          {isDraft && canDispatch && isSourceUser ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onDispatch}
              className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Dispatch transfer
            </button>
          ) : null}
          {isDispatched && canReceive && isDestUser ? (
            <button
              type="button"
              disabled={busy}
              onClick={props.onReceive}
              className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Receive transfer
            </button>
          ) : null}
        </div>
      </div>
    </DocDialog>
  );
}
