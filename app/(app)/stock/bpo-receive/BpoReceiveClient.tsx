"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  deleteReceivedBpoBatch,
  receiveBpoStock,
  updateReceivedBpoBatch,
  type BpoReceiveResult,
} from "./actions";

type SalesPointOpt = { id: number; name: string };
type VariantOpt = { id: string; label: string; unitLabel: string };

export type BpoReceiptRow = {
  id: string;
  salesPointId: number;
  salesPointName: string;
  productVariantId: string;
  variantLabel: string;
  unitLabel: string;
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

export function BpoReceiveClient(props: {
  salesPoints: SalesPointOpt[];
  variants: VariantOpt[];
  recentReceipts: BpoReceiptRow[];
  defaultSalesPointId: number | null;
  salesPointLocked: boolean;
}) {
  const { salesPoints, variants, recentReceipts, defaultSalesPointId, salesPointLocked } = props;
  const router = useRouter();
  const initialSpId = defaultSalesPointId ?? salesPoints[0]?.id ?? 0;
  const [spId, setSpId] = React.useState(initialSpId);
  const [draft, setDraft] = React.useState<BpoReceiptRow | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<BpoReceiptRow | null>(null);
  const [banner, setBanner] = React.useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (salesPointLocked && defaultSalesPointId != null && !draft) {
      window.queueMicrotask(() => setSpId(defaultSalesPointId));
    }
  }, [salesPointLocked, defaultSalesPointId, draft]);

  const effectiveSpId = draft ? draft.salesPointId : spId;
  const spLabel = salesPoints.find((s) => s.id === effectiveSpId)?.name ?? "—";
  const formKey = draft ? `edit-${draft.id}` : `new-${spId}`;

  function cancelEdit() {
    setDraft(null);
    setBanner(null);
    setSpId(defaultSalesPointId ?? salesPoints[0]?.id ?? 0);
  }

  function startEdit(row: BpoReceiptRow) {
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
      const r: BpoReceiveResult = draft
        ? await updateReceivedBpoBatch(fd)
        : await receiveBpoStock(fd);
      if (r.ok) {
        setBanner({ type: "ok", text: draft ? "BPO receipt updated." : "BPO stock receipt recorded." });
        if (draft) setDraft(null);
        (e.target as HTMLFormElement).reset();
        setSpId(defaultSalesPointId ?? salesPoints[0]?.id ?? 0);
        router.refresh();
      } else {
        setBanner({ type: "err", text: r.error });
      }
    } finally {
      setBusy(false);
    }
  }

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
              <p className="text-xs opacity-70">
                Bota is excluded here. Bota receives BPO through validated consignment documents.
              </p>
            </>
          )}
        </div>

        <div className="grid gap-1">
          <label htmlFor="productVariantId" className="text-sm font-medium">
            BPO variant
          </label>
          <select
            key={`${formKey}-variant`}
            id="productVariantId"
            name="productVariantId"
            className="h-10 rounded-md border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
            required
            disabled={Boolean(draft?.hasConsumption)}
            defaultValue={draft?.productVariantId ?? ""}
          >
            <option value="">Select BPO variant</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          {draft?.hasConsumption ? (
            <p className="text-xs opacity-70">Variant is locked because stock from this receipt moved out.</p>
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
            className="h-10 rounded-md border border-black/10 bg-transparent px-3 text-sm dark:border-white/10 disabled:opacity-60"
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
            className="h-10 rounded-md border border-black/10 bg-transparent px-3 text-sm dark:border-white/10"
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
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10"
            defaultValue={draft?.note ?? ""}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy || variants.length === 0 || salesPoints.length === 0}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {busy ? "Saving..." : draft ? "Save changes" : "Record BPO receipt"}
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

      <section className="space-y-3 max-w-5xl">
        <h2 className="text-lg font-semibold">Recent BPO receipts</h2>
        <p className="text-sm opacity-75">
          These receipts create local BPO stock at non-Bota sales points. That stock can later be
          consigned to Bota through the BPO consignment workflow.
        </p>
        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 text-left">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Sales point</th>
                <th className="px-3 py-2 font-medium">Variant</th>
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
                  <tr
                    key={row.id}
                    className="border-b border-black/5 dark:border-white/5 odd:bg-black/2 dark:odd:bg-white/2"
                  >
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{row.receivedAtIso}</td>
                    <td className="px-3 py-2">{row.salesPointName}</td>
                    <td className="px-3 py-2">{row.variantLabel}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtUnits(row.qtyReceivedUnits)} {row.unitLabel}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtUnits(row.qtyRemainingUnits)} {row.unitLabel}
                    </td>
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

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete this BPO receipt?"
          description={`Remove the ${deleteTarget.receivedAtIso} receipt for ${deleteTarget.variantLabel} (${fmtUnits(deleteTarget.qtyReceivedUnits)} units). This cannot be undone.`}
          confirmLabel="Delete receipt"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setBanner(null);
            setBusy(true);
            try {
              const fd = new FormData();
              fd.set("batchId", deleteTarget.id);
              const r = await deleteReceivedBpoBatch(fd);
              if (r.ok) {
                setBanner({ type: "ok", text: "BPO receipt deleted." });
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
