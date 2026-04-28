"use client";

import * as React from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ProductCatRow = {
  productCatId: number;
  productCat: string;
  productCode: string;
};

export function ProductCategoriesClient(props: {
  categories: ProductCatRow[];
  saveProductCatAction: (formData: FormData) => void;
  deleteProductCatAction: (formData: FormData) => void;
}) {
  const { categories, saveProductCatAction, deleteProductCatAction } = props;

  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: number;
    label: string;
  } | null>(null);
  const [productCat, setProductCat] = React.useState("");
  const [productCode, setProductCode] = React.useState("");

  function reset() {
    setEditingId(null);
    setProductCat("");
    setProductCode("");
  }

  function startEdit(c: ProductCatRow) {
    setEditingId(c.productCatId);
    setProductCat(c.productCat);
    setProductCode(c.productCode);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Product categories</h1>
        <p className="text-sm opacity-75">
          Categories group your products (separate from individual product records).{" "}
          <Link href="/products" className="underline underline-offset-4">
            Manage products
          </Link>
          .
        </p>
      </div>

      <form action={saveProductCatAction} className="space-y-4 max-w-xl">
        {editingId != null ? (
          <input type="hidden" name="productCatId" value={String(editingId)} />
        ) : null}

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="productCat">
            Category name
          </label>
          <input
            id="productCat"
            name="productCat"
            value={productCat}
            onChange={(e) => setProductCat(e.target.value)}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="productCode">
            Category code
          </label>
          <input
            id="productCode"
            name="productCode"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
            {editingId != null ? "Save category" : "Add category"}
          </button>
          {editingId != null ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">All categories</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-4">Name</div>
            <div className="col-span-4">Code</div>
            <div className="col-span-4">Actions</div>
          </div>

          {categories.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No categories yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {categories.map((c) => (
                <li
                  key={c.productCatId}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="col-span-4 font-medium truncate">{c.productCat}</div>
                  <div className="col-span-4 truncate opacity-80">{c.productCode}</div>
                  <div className="col-span-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({
                          id: c.productCatId,
                          label: `${c.productCat} (${c.productCode})`,
                        })
                      }
                      className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-xs opacity-70">
          Showing {categories.length} {categories.length === 1 ? "category" : "categories"}.
        </div>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this category?"
          description={`“${pendingDelete.label}” will be removed permanently. You cannot undo this action.`}
          confirmLabel="Delete category"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("productCatId", String(pendingDelete.id));
            await deleteProductCatAction(fd);
            setPendingDelete(null);
            reset();
          }}
        />
      ) : null}
    </div>
  );
}
