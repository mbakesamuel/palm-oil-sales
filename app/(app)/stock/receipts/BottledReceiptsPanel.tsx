"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  deleteReceivedBottledBatch,
  receiveBottledStock,
  updateReceivedBottledBatch,
  type ReceiptStockResult,
} from "./actions";

type SalesPointOpt = { id: number; name: string };
type ProductOpt = { productId: number; label: string };

export type BpoReceiptRow = {
  id: string;
  salesPointId: number;
  salesPointName: string;
  productId: number;
  productLabel: string;
  receivedAtIso: string;
  qtyReceivedUnits: string;
  qtyRemainingUnits: string;
  note: string | null;
  hasConsumption: boolean;
};

function fmtUnits(s: string) {
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n)) return s;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n);
}

export function BottledReceiptsPanel(props: {
  salesPoints: SalesPointOpt[];
  products: ProductOpt[];
  recentReceipts: BpoReceiptRow[];
  defaultSalesPointId: number | null;
  salesPointLocked: boolean;
  canEditReceiptRows: boolean;
  embedded?: boolean;
  hideRecentList?: boolean;
}) {
  const {
    salesPoints,
    products,
    recentReceipts,
    defaultSalesPointId,
    salesPointLocked,
    canEditReceiptRows,
    hideRecentList = false,
  } = props;
  const router = useRouter();
  const initialSpId = defaultSalesPointId ?? salesPoints[0]?.id ?? 0;
  const [spId, setSpId] = React.useState(initialSpId);
  const [draft, setDraft] = React.useState<BpoReceiptRow | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<BpoReceiptRow | null>(null);
  const [banner, setBanner] = React.useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const busyRef = React.useRef(false);

  React.useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  React.useEffect(() => {
    if (salesPointLocked && defaultSalesPointId != null && !draft) {
      window.queueMicrotask(() => setSpId(defaultSalesPointId));
    }
  }, [salesPointLocked, defaultSalesPointId, draft]);

  const dismissReceiptModal = React.useCallback((clearBanner: boolean) => {
    setReceiptModalOpen(false);
    setDraft(null);
    setSpId(defaultSalesPointId ?? salesPoints[0]?.id ?? 0);
    if (clearBanner) setBanner(null);
  }, [defaultSalesPointId, salesPoints]);

  React.useEffect(() => {
    if (!receiptModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busyRef.current) dismissReceiptModal(true);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [receiptModalOpen, dismissReceiptModal]);

  const effectiveSpId = draft ? draft.salesPointId : spId;
  const spLabel = salesPoints.find((s) => s.id === effectiveSpId)?.name ?? "—";
  const formKey = draft ? `edit-${draft.id}` : `new-${spId}`;

  function openNewReceiptModal() {
    setDraft(null);
    setBanner(null);
    setSpId(defaultSalesPointId ?? salesPoints[0]?.id ?? 0);
    setReceiptModalOpen(true);
  }

  function startEdit(row: BpoReceiptRow) {
    if (!canEditReceiptRows) return;
    setDraft(row);
    setSpId(row.salesPointId);
    setBanner(null);
    setReceiptModalOpen(true);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);
    setBusy(true);
    try {
      const formEl = e.currentTarget;
      const fd = new FormData(formEl);
      const isEdit = Boolean(draft);
      const r: ReceiptStockResult = isEdit ? await updateReceivedBottledBatch(fd) : await receiveBottledStock(fd);
      if (r.ok) {
        dismissReceiptModal(false);
        formEl.reset();
        setBanner({
          type: "ok",
          text: isEdit ? "BPO receipt updated." : "BPO stock receipt recorded.",
        });
        router.refresh();
      } else {
        setBanner({ type: "err", text: r.error });
      }
    } finally {
      setBusy(false);
    }
  }

  const receiptForm = (
    <form key={formKey} className="space-y-4" onSubmit={onSubmit}>
      {draft ? <input type="hidden" name="batchId" value={draft.id} /> : null}

      {banner && receiptModalOpen ? (
        <div
          className={
            banner.type === "ok"
              ? "rounded-lg border border-emerald-600/40 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-200"
              : "rounded-lg border border-red-600/40 bg-red-600/5 px-4 py-3 text-sm text-red-950 dark:text-red-200"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <div className="grid gap-1">
        <label htmlFor="salesPointId" className="text-sm font-medium">
          Sales point
        </label>
        {draft ? (
          <>
            <input type="hidden" name="salesPointId" value={String(draft.salesPointId)} />
            <div className="h-10 flex items-center rounded-md border border-border px-3 text-sm bg-foreground/[0.04]">
              {spLabel}
            </div>
            <p className="text-xs opacity-70">Sales point is fixed for this BPO receipt.</p>
          </>
        ) : (
          <>
            {salesPointLocked && defaultSalesPointId != null ? (
              <input type="hidden" name="salesPointId" value={defaultSalesPointId} />
            ) : null}
            <select
              id="salesPointId"
              name={salesPointLocked ? undefined : "salesPointId"}
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              required={!salesPointLocked}
              value={String(spId)}
              onChange={(e) => {
                if (!salesPointLocked) setSpId(Number(e.target.value));
              }}
              disabled={salesPointLocked}
            >
              {salesPoints.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
            <p className="text-xs opacity-70">
              Bota is excluded here. Bota receives BPO through validated consignment documents.
            </p>
          </>
        )}
      </div>

      <div className="grid gap-1">
        <label htmlFor="productId" className="text-sm font-medium">
          Bottled product
        </label>
        <select
          key={`${formKey}-product`}
          id="productId"
          name="productId"
          className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
          required
          disabled={Boolean(draft?.hasConsumption)}
          defaultValue={draft?.productId != null ? String(draft.productId) : ""}
        >
          <option value="">Select product</option>
          {products.map((p) => (
            <option key={p.productId} value={p.productId}>
              {p.label}
            </option>
          ))}
        </select>
        {draft?.hasConsumption ? (
          <p className="text-xs opacity-70">Product is locked because stock from this receipt moved out.</p>
        ) : null}
      </div>

      <div className="grid gap-1">
        <label htmlFor="qtyUnits" className="text-sm font-medium">
          Quantity received (units)
        </label>
        <input
          key={`${formKey}-qty`}
          id="qtyUnits"
          name="qtyUnits"
          type="text"
          inputMode="decimal"
          className="h-10 rounded-md border border-border bg-transparent px-3 text-sm disabled:opacity-60"
          placeholder="e.g. 120"
          required
          disabled={Boolean(draft?.hasConsumption)}
          defaultValue={draft?.qtyReceivedUnits}
        />
        {draft?.hasConsumption ? (
          <p className="text-xs opacity-70">Quantity is locked because stock from this receipt moved out.</p>
        ) : null}
      </div>

      <div className="grid gap-1">
        <label htmlFor="receivedAt" className="text-sm font-medium">
          Receipt date
        </label>
        <input
          key={`${formKey}-date`}
          id="receivedAt"
          name="receivedAt"
          type="date"
          className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
          defaultValue={draft?.receivedAtIso}
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor="note" className="text-sm font-medium">
          Note (optional)
        </label>
        <textarea
          key={`${formKey}-note`}
          id="note"
          name="note"
          rows={2}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          defaultValue={draft?.note ?? ""}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={busy || products.length === 0 || salesPoints.length === 0}
          className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy ? "Saving..." : draft ? "Save changes" : "Record BPO receipt"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => dismissReceiptModal(true)}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent/25 disabled:opacity-50"
        >
          {draft ? "Cancel edit" : "Cancel"}
        </button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {banner && !receiptModalOpen ? (
        <div
          className={
            banner.type === "ok"
              ? "rounded-lg border border-emerald-600/40 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-200"
              : "rounded-lg border border-red-600/40 bg-red-600/5 px-4 py-3 text-sm text-red-950 dark:text-red-200"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {hideRecentList ? (
        canEditReceiptRows ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openNewReceiptModal}
              disabled={products.length === 0 || salesPoints.length === 0}
              className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              Record bottled receipt
            </button>
            <p className="text-sm opacity-75">
              Direct bottled receipts at collection points (not at Bota). Use Transfer to send stock
              to Bota.
            </p>
          </div>
        ) : (
          <p className="text-sm opacity-75">
            Bottled receipts at collection points are managed by assigned clerks. Use the activity
            feed below for history.
          </p>
        )
      ) : (
      <section className="space-y-3 max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Recent BPO receipts</h2>
          {canEditReceiptRows ? (
            <button
              type="button"
              onClick={openNewReceiptModal}
              disabled={products.length === 0 || salesPoints.length === 0}
              className="shrink-0 rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              Record BPO receipt
            </button>
          ) : null}
        </div>
        <p className="text-sm opacity-75">
          These receipts create local BPO stock at non-Bota sales points. That stock can later be
          consigned to Bota through the BPO consignment workflow.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Sales point</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium text-right">Received</th>
                <th className="px-3 py-2 font-medium text-right">Remaining</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentReceipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-sm opacity-75">
                    No BPO receipts in scope yet.
                  </td>
                </tr>
              ) : (
                recentReceipts.map((row) => (
                  <tr key={row.id} className="border-b border-border odd:bg-foreground/[0.04]">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{row.receivedAtIso}</td>
                    <td className="px-3 py-2">{row.salesPointName}</td>
                    <td className="px-3 py-2">{row.productLabel}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtUnits(row.qtyReceivedUnits)} units
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtUnits(row.qtyRemainingUnits)} units
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {canEditReceiptRows ? (
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/25"
                          >
                            Edit
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={row.hasConsumption}
                          title={row.hasConsumption ? "Cannot delete - stock already moved out" : "Delete receipt"}
                          onClick={() => setDeleteTarget(row)}
                          className="rounded-md border border-red-600/40 px-2 py-1 text-xs text-red-700 disabled:opacity-40 dark:text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {receiptModalOpen ? (
        <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/45 dark:bg-black/55 backdrop-blur-[2px]"
            aria-hidden
            onClick={() => {
              if (!busy) dismissReceiptModal(true);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="bpo-receive-dialog-title"
            className="relative z-10 w-full max-w-xl max-h-[min(90vh,720px)] overflow-y-auto rounded-2xl border border-border bg-background text-foreground shadow-xl shadow-black/10 dark:shadow-black/40"
          >
            <div className="p-5 sm:p-6 space-y-4">
              <h2 id="bpo-receive-dialog-title" className="text-lg font-semibold text-foreground pr-8">
                {draft ? "Edit BPO receipt" : "Record BPO receipt"}
              </h2>
              {receiptForm}
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete this BPO receipt?"
          description={`Remove the ${deleteTarget.receivedAtIso} receipt for ${deleteTarget.productLabel} (${fmtUnits(deleteTarget.qtyReceivedUnits)} units). This cannot be undone.`}
          confirmLabel="Delete receipt"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setBanner(null);
            setBusy(true);
            try {
              const fd = new FormData();
              fd.set("batchId", deleteTarget.id);
              const r = await deleteReceivedBottledBatch(fd);
              if (r.ok) {
                if (draft?.id === deleteTarget.id) dismissReceiptModal(false);
                setBanner({ type: "ok", text: "BPO receipt deleted." });
                router.refresh();
              } else {
                setBanner({ type: "err", text: r.error });
              }
            } finally {
              setBusy(false);
              setDeleteTarget(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
