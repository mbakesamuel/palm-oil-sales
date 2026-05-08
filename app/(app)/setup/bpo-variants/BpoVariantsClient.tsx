"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ProductOpt = { productId: number; productName: string };
type VariantRow = {
  id: string;
  productId: number;
  productName: string;
  name: string;
  unitLabel: string;
  unitQuantity: string | null;
  isActive: boolean;
};
type PriceRow = {
  id: string;
  productVariantId: string;
  variantLabel: string;
  effectiveFromIso: string;
  unitPriceExTax: string;
};

export function BpoVariantsClient(props: {
  products: ProductOpt[];
  variants: VariantRow[];
  prices: PriceRow[];
  saveVariantAction: (formData: FormData) => void | Promise<void>;
  deleteVariantAction: (formData: FormData) => void | Promise<void>;
  savePriceAction: (formData: FormData) => void | Promise<void>;
  deletePriceAction: (formData: FormData) => void | Promise<void>;
}) {
  const {
    products,
    variants,
    prices,
    saveVariantAction,
    deleteVariantAction,
    savePriceAction,
    deletePriceAction,
  } = props;
  const [variantDraft, setVariantDraft] = React.useState<VariantRow | null>(null);
  const [priceDraft, setPriceDraft] = React.useState<PriceRow | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<
    { kind: "variant" | "price"; id: string; label: string } | null
  >(null);

  const defaultProductId = String(variantDraft?.productId ?? products[0]?.productId ?? "");
  const defaultVariantId = String(priceDraft?.productVariantId ?? variants[0]?.id ?? "");

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Bottled Palm Oil variants</h1>
        <p className="text-sm opacity-75">
          Manage BPO bottle sizes and their approved ex-tax prices by effective date.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 p-4 text-sm">
          Flag a product as Bottled Palm Oil on the Products page before adding variants.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            key={variantDraft?.id ?? "new-variant"}
            action={async (formData) => {
              await saveVariantAction(formData);
              setVariantDraft(null);
            }}
            className="space-y-4 rounded-lg border border-black/10 dark:border-white/10 p-4"
          >
            <h2 className="font-semibold">{variantDraft ? "Edit variant" : "Add variant"}</h2>
            {variantDraft ? <input type="hidden" name="id" value={variantDraft.id} /> : null}
            <div className="grid gap-1">
              <label className="text-sm font-medium">BPO product</label>
              <select
                name="productId"
                defaultValue={defaultProductId}
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                required
              >
                {products.map((p) => (
                  <option key={p.productId} value={p.productId}>
                    {p.productName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Variant / size label</label>
              <input
                name="name"
                defaultValue={variantDraft?.name ?? ""}
                placeholder="1L bottle, 5L bottle"
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-sm font-medium">Unit label</label>
                <input
                  name="unitLabel"
                  defaultValue={variantDraft?.unitLabel ?? "Bottle"}
                  className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Unit quantity</label>
                <input
                  name="unitQuantity"
                  inputMode="decimal"
                  defaultValue={variantDraft?.unitQuantity ?? ""}
                  placeholder="Optional, e.g. 5"
                  className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={variantDraft?.isActive ?? true} />
              Active
            </label>
            <div className="flex gap-2">
              <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
                Save variant
              </button>
              {variantDraft ? (
                <button
                  type="button"
                  onClick={() => setVariantDraft(null)}
                  className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <form
            key={priceDraft?.id ?? "new-price"}
            action={async (formData) => {
              await savePriceAction(formData);
              setPriceDraft(null);
            }}
            className="space-y-4 rounded-lg border border-black/10 dark:border-white/10 p-4"
          >
            <h2 className="font-semibold">{priceDraft ? "Edit price" : "Add variant price"}</h2>
            {priceDraft ? <input type="hidden" name="id" value={priceDraft.id} /> : null}
            <div className="grid gap-1">
              <label className="text-sm font-medium">Variant</label>
              <select
                name="productVariantId"
                defaultValue={defaultVariantId}
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                required
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.productName} - {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-sm font-medium">Effective from</label>
                <input
                  type="date"
                  name="effectiveFrom"
                  defaultValue={priceDraft?.effectiveFromIso ?? ""}
                  className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  required
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium">Unit price ex tax</label>
                <input
                  name="unitPriceExTax"
                  inputMode="decimal"
                  defaultValue={priceDraft?.unitPriceExTax ?? ""}
                  className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                disabled={variants.length === 0}
                className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Save price
              </button>
              {priceDraft ? (
                <button
                  type="button"
                  onClick={() => setPriceDraft(null)}
                  className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Variants</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          {variants.map((v) => (
            <div key={v.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b border-black/10 dark:border-white/10 last:border-0">
              <div className="col-span-4 font-medium">{v.productName} - {v.name}</div>
              <div className="col-span-3 opacity-75">
                {v.unitLabel}
                {v.unitQuantity ? ` (${v.unitQuantity})` : ""}
              </div>
              <div className="col-span-2">{v.isActive ? "Active" : "Inactive"}</div>
              <div className="col-span-3 flex justify-end gap-2">
                <button type="button" className="underline text-xs" onClick={() => setVariantDraft(v)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="underline text-xs text-red-700 dark:text-red-400"
                  onClick={() => setDeleteTarget({ kind: "variant", id: v.id, label: v.name })}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {variants.length === 0 ? <div className="p-4 text-sm opacity-75">No variants yet.</div> : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Price schedules</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          {prices.map((p) => (
            <div key={p.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm border-b border-black/10 dark:border-white/10 last:border-0">
              <div className="col-span-5 font-medium">{p.variantLabel}</div>
              <div className="col-span-3 tabular-nums">{p.effectiveFromIso}</div>
              <div className="col-span-2 text-right tabular-nums">{p.unitPriceExTax}</div>
              <div className="col-span-2 flex justify-end gap-2">
                <button type="button" className="underline text-xs" onClick={() => setPriceDraft(p)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="underline text-xs text-red-700 dark:text-red-400"
                  onClick={() => setDeleteTarget({ kind: "price", id: p.id, label: p.variantLabel })}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {prices.length === 0 ? <div className="p-4 text-sm opacity-75">No variant prices yet.</div> : null}
        </div>
      </section>

      {deleteTarget ? (
        <ConfirmDialog
          title={`Delete ${deleteTarget.kind === "variant" ? "variant" : "price row"}?`}
          description={deleteTarget.label}
          confirmLabel="Delete"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("id", deleteTarget.id);
            if (deleteTarget.kind === "variant") await deleteVariantAction(fd);
            else await deletePriceAction(fd);
            setDeleteTarget(null);
          }}
        />
      ) : null}
    </div>
  );
}
