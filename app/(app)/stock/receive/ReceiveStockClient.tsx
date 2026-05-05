"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  receiveStock,
  updateReceivedBatch,
  deleteReceivedBatch,
  type ReceiveStockResult,
} from "./actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type SalesPointOpt = { id: number; name: string };
type ProductOpt = { productId: number; productName: string };
type StorageLocOpt = { id: number; name: string; salesPointId: number };

export type RecentReceiptRow = {
  id: string;
  salesPointId: number;
  storageLocationId: number;
  storageLocationName: string;
  productId: number;
  productName: string;
  receivedAtIso: string;
  qtyReceivedKg: string;
  qtyRemainingKg: string;
  note: string | null;
  hasAllocations: boolean;
};

function fmtKg(s: string) {
  const n = Number(String(s).replace(",", "."));
  if (!Number.isFinite(n)) return s;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(n);
}

export function ReceiveStockClient(props: {
  salesPoints: SalesPointOpt[];
  products: ProductOpt[];
  storageLocations: StorageLocOpt[];
  recentReceipts: RecentReceiptRow[];
  defaultSalesPointId: number | null;
  salesPointLocked: boolean;
}) {
  const {
    salesPoints,
    products,
    storageLocations,
    recentReceipts,
    defaultSalesPointId,
    salesPointLocked,
  } = props;

  const initialSpId = defaultSalesPointId ?? salesPoints[0]?.id ?? 0;
  const [spId, setSpId] = React.useState(initialSpId);
  const [draft, setDraft] = React.useState<RecentReceiptRow | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<RecentReceiptRow | null>(null);
  const [banner, setBanner] = React.useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (salesPointLocked && defaultSalesPointId != null && !draft) {
      setSpId(defaultSalesPointId);
    }
  }, [salesPointLocked, defaultSalesPointId, draft]);

  const effectiveSpId = draft ? draft.salesPointId : spId;
  const locsForSp = storageLocations.filter((l) => l.salesPointId === effectiveSpId);
  const spLabel = salesPoints.find((s) => s.id === effectiveSpId)?.name ?? "—";

  function cancelEdit() {
    setDraft(null);
    setBanner(null);
    if (salesPointLocked && defaultSalesPointId != null) {
      setSpId(defaultSalesPointId);
    } else {
      setSpId(salesPoints[0]?.id ?? 0);
    }
  }

  function startEdit(row: RecentReceiptRow) {
    setDraft(row);
    setSpId(row.salesPointId);
    setBanner(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const r: ReceiveStockResult = draft
        ? await updateReceivedBatch(fd)
        : await receiveStock(fd);
      if (r.ok) {
        setBanner({
          type: "ok",
          text: draft ? "Receipt updated." : "Stock receipt recorded.",
        });
        if (draft) {
          setDraft(null);
        }
        (e.target as HTMLFormElement).reset();
        const nextSp = defaultSalesPointId ?? salesPoints[0]?.id ?? 0;
        if (!salesPointLocked) setSpId(nextSp);
        else if (defaultSalesPointId != null) setSpId(defaultSalesPointId);
        router.refresh();
      } else {
        setBanner({ type: "err", text: r.error });
      }
    } finally {
      setBusy(false);
    }
  }

  const formKey = draft ? `edit-${draft.id}` : `new-${spId}`;

  return (
    <div className="space-y-10">
      <form key={formKey} className="max-w-xl space-y-4" onSubmit={onSubmit}>
        {draft ? <input type="hidden" name="batchId" value={draft.id} /> : null}

        {banner ? (
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
              <div className="h-10 flex items-center rounded-md border border-black/10 px-3 text-sm dark:border-white/10 bg-black/2 dark:bg-white/4">
                {spLabel}
              </div>
              <p className="text-xs opacity-70">Sales point is fixed for this receipt.</p>
            </>
          ) : (
            <>
              {salesPointLocked && defaultSalesPointId != null ? (
                <input type="hidden" name="salesPointId" value={defaultSalesPointId} />
              ) : null}
              <select
                id="salesPointId"
                name={salesPointLocked ? undefined : "salesPointId"}
                className="h-10 rounded-md border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
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
              {salesPointLocked ? (
                <p className="text-xs opacity-70">
                  Receipts are posted only at your assigned collection point.
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="grid gap-1">
          <label htmlFor="storageLocationId" className="text-sm font-medium">
            Storage location
          </label>
          <select
            key={`${formKey}-loc`}
            id="storageLocationId"
            name="storageLocationId"
            className="h-10 rounded-md border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
            required={locsForSp.length > 0}
            disabled={locsForSp.length === 0}
            defaultValue={draft ? draft.storageLocationId : ""}
          >
            {locsForSp.length === 0 ? (
              <option value="">No locations for this sales point</option>
            ) : (
              <>
                <option value="">Select storage location</option>
                {locsForSp.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </>
            )}
          </select>
          {locsForSp.length === 0 ? (
            <p className="text-xs opacity-80">
              Add tanks or storage bays under{" "}
              <Link href="/storage-locations" className="underline font-medium">
                Storage locations
              </Link>{" "}
              in Settings.
            </p>
          ) : (
            <p className="text-xs opacity-70">
              Physical placement only — sales still draw from the combined pool at this collection
              point.
            </p>
          )}
        </div>

        <div className="grid gap-1">
          <label htmlFor="productId" className="text-sm font-medium">
            Product
          </label>
          <select
            key={`${formKey}-prod`}
            id="productId"
            name="productId"
            className="h-10 rounded-md border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
            required
            disabled={Boolean(draft?.hasAllocations)}
            defaultValue={draft?.productId}
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.productName}
              </option>
            ))}
          </select>
          {draft?.hasAllocations ? (
            <p className="text-xs opacity-70">
              Product is locked — validated sales already reference this receipt.
            </p>
          ) : null}
        </div>

        <div className="grid gap-1">
          <div className="grid gap-1">
            <label htmlFor="qtyKg" className="text-sm font-medium">
              Quantity received (kg)
            </label>
            <input
              key={`${formKey}-qty`}
              id="qtyKg"
              name="qtyKg"
              type="text"
              inputMode="decimal"
              className="h-10 rounded-md border border-black/10 bg-transparent px-3 text-sm dark:border-white/10 disabled:opacity-60"
              placeholder="e.g. 1500"
              required
              disabled={Boolean(draft?.hasAllocations)}
              defaultValue={draft?.qtyReceivedKg}
            />
            {draft?.hasAllocations ? (
              <p className="text-xs opacity-70">
                Quantity is locked — stock from this receipt was already sold.
              </p>
            ) : null}
          </div>
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
            className="h-10 rounded-md border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={draft?.receivedAtIso}
          />
          <p className="text-xs opacity-70">Defaults to today if left blank (new receipt only).</p>
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
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
            defaultValue={draft?.note ?? ""}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy || locsForSp.length === 0}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {busy ? "Saving…" : draft ? "Save changes" : "Record receipt"}
          </button>
          {draft ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <section className="space-y-3 max-w-4xl">
        <h2 className="text-lg font-semibold">Recent receipts</h2>
        <p className="text-sm opacity-75">
          Edit date, storage, or note anytime. Product and quantity can only change if no
          validated sale has used this receipt yet. Delete is only allowed in that case.
        </p>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 text-left">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium text-right">Received (kg)</th>
                <th className="px-3 py-2 font-medium text-right">Remaining (kg)</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentReceipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-sm opacity-75">
                    No receipts in scope yet.
                  </td>
                </tr>
              ) : (
                recentReceipts.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-black/5 dark:border-white/5 odd:bg-black/2 dark:odd:bg-white/2"
                  >
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{row.receivedAtIso}</td>
                    <td className="px-3 py-2">{row.productName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtKg(row.qtyReceivedKg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtKg(row.qtyRemainingKg)}</td>
                    <td className="px-3 py-2 text-xs opacity-90">{row.storageLocationName}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="rounded-md border border-black/10 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={row.hasAllocations}
                          title={
                            row.hasAllocations
                              ? "Cannot delete — used on validated sales"
                              : "Delete receipt"
                          }
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

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete this receipt?"
          description={`Remove the ${deleteTarget.receivedAtIso} receipt for ${deleteTarget.productName} (${fmtKg(deleteTarget.qtyReceivedKg)} kg). This cannot be undone.`}
          confirmLabel="Delete receipt"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setBanner(null);
            setBusy(true);
            try {
              const fd = new FormData();
              fd.set("batchId", deleteTarget.id);
              const r = await deleteReceivedBatch(fd);
              if (r.ok) {
                setBanner({ type: "ok", text: "Receipt deleted." });
                if (draft?.id === deleteTarget.id) cancelEdit();
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
