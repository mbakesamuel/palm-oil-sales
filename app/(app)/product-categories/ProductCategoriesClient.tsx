"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ProductCatRow = {
  productCatId: number;
  productCat: string;
  productCode: string;
  isMain: boolean;
};

export function ProductCategoriesClient(props: {
  categories: ProductCatRow[];
  saveProductCatAction: (formData: FormData) => void | Promise<void>;
  deleteProductCatAction: (formData: FormData) => void | Promise<void>;
}) {
  const { categories, saveProductCatAction, deleteProductCatAction } = props;
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: number;
    label: string;
  } | null>(null);
  const [productCat, setProductCat] = React.useState("");
  const [productCode, setProductCode] = React.useState("");
  const [isMain, setIsMain] = React.useState(false);
  const [banner, setBanner] = React.useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const existingMain = categories.find((c) => c.isMain);
  const anotherMainExists =
    existingMain != null && existingMain.productCatId !== editingId;

  function resetForm() {
    setEditingId(null);
    setProductCat("");
    setProductCode("");
    setIsMain(false);
  }

  function openCreate() {
    resetForm();
    setBanner(null);
    setIsFormOpen(true);
  }

  function startEdit(c: ProductCatRow) {
    setEditingId(c.productCatId);
    setProductCat(c.productCat);
    setProductCode(c.productCode);
    setIsMain(c.isMain);
    setBanner(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    resetForm();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const fd = new FormData(e.currentTarget);
    if (editingId != null) fd.set("productCatId", String(editingId));

    const wasEdit = editingId != null;
    setBusy(true);
    setBanner(null);
    try {
      await saveProductCatAction(fd);
      setIsFormOpen(false);
      resetForm();
      setBanner({
        type: "ok",
        text: wasEdit ? "Category updated." : "Category added.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save the category.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Product categories</h1>
          <p className="text-sm opacity-75">
            Categories group your products (separate from individual product
            records).{" "}
            <Link href="/products" className="underline underline-offset-4">
              Manage products
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
        >
          Add category
        </button>
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

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">All categories</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-border">
            <div className="col-span-4">Name</div>
            <div className="col-span-3">Code</div>
            <div className="col-span-2">Main?</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>

          {categories.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No categories yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {categories.map((c) => (
                <li
                  key={c.productCatId}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="col-span-4 font-medium truncate">{c.productCat}</div>
                  <div className="col-span-3 truncate opacity-80">{c.productCode}</div>
                  <div className="col-span-2">
                    {c.isMain ? (
                      <span className="inline-flex items-center rounded-md border border-emerald-600/40 bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                        Main
                      </span>
                    ) : (
                      <span className="text-xs opacity-50">—</span>
                    )}
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(c)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
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

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={editingId != null ? "Edit category" : "Add category"}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeForm();
          }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={closeForm}
          />

          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background text-foreground p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold">
                {editingId != null ? "Edit category" : "Add category"}
              </div>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 text-xs"
                onClick={closeForm}
                aria-label="Close"
              >
                X
              </button>
            </div>

            <form
              onSubmit={(e) => void onSubmit(e)}
              className="mt-4 space-y-4 max-h-[min(36rem,calc(100vh-6rem))] overflow-y-auto pr-1"
            >
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="pc-cat">
                  Category name
                </label>
                <input
                  id="pc-cat"
                  name="productCat"
                  value={productCat}
                  onChange={(e) => setProductCat(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  required
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="pc-code">
                  Category code
                </label>
                <input
                  id="pc-code"
                  name="productCode"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="grid gap-1">
                <label className="inline-flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="isMain"
                    checked={isMain}
                    onChange={(e) => setIsMain(e.target.checked)}
                    className="size-4"
                  />
                  Main category (uses customer-type segmented pricing)
                </label>
                <p className="text-xs opacity-70">
                  Exactly one category can be marked as Main. Products in this
                  category are priced per customer type (Industry / Wholesale /
                  Retail / Worker); all other categories use one direct price
                  per product.
                  {anotherMainExists && isMain ? (
                    <>
                      {" "}
                      Saving will transfer the Main flag from &ldquo;
                      {existingMain?.productCat}&rdquo; to this category.
                    </>
                  ) : null}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent/25"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {busy
                    ? "Saving…"
                    : editingId != null
                      ? "Save category"
                      : "Add category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this category?"
          description={`“${pendingDelete.label}” will be removed permanently. You cannot undo this action.`}
          confirmLabel="Delete category"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            try {
              const fd = new FormData();
              fd.set("productCatId", String(pendingDelete.id));
              await deleteProductCatAction(fd);
              setBanner({ type: "ok", text: "Category deleted." });
              router.refresh();
            } catch (err) {
              setBanner({
                type: "error",
                text:
                  err instanceof Error
                    ? err.message
                    : "Could not delete the category.",
              });
            } finally {
              setPendingDelete(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
