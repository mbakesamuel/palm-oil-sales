"use client";

import * as React from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ProductCatOption = {
  productCatId: number;
  productCat: string;
  productCode: string;
};

type ProductRow = {
  productId: number;
  productName: string;
  productCode: string | null;
  productCatId: number;
  productCat: { productCatId: number; productCat: string };
};

export function ProductsClient(props: {
  categories: ProductCatOption[];
  products: ProductRow[];
  saveProductAction: (formData: FormData) => void | Promise<void>;
  deleteProductAction: (formData: FormData) => void | Promise<void>;
}) {
  const { categories, products, saveProductAction, deleteProductAction } = props;

  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: number;
    name: string;
  } | null>(null);
  const [productName, setProductName] = React.useState("");
  const [productCode, setProductCode] = React.useState("");
  const [productCatId, setProductCatId] = React.useState(
    () => String(categories[0]?.productCatId ?? ""),
  );

  const productCatIdForSelect =
    editingId != null &&
    productCatId &&
    !categories.some((c) => String(c.productCatId) === productCatId)
      ? String(categories[0]?.productCatId ?? "")
      : productCatId;

  function reset() {
    setEditingId(null);
    setProductName("");
    setProductCode("");
    setProductCatId(String(categories[0]?.productCatId ?? ""));
  }

  function startEdit(p: ProductRow) {
    setEditingId(p.productId);
    setProductName(p.productName);
    setProductCode(p.productCode ?? "");
    setProductCatId(String(p.productCatId));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="text-sm opacity-75">
          Individual items you sell. Categories are managed on a{" "}
          <Link href="/product-categories" className="underline underline-offset-4">
            separate page
          </Link>
          .
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 text-sm">
          <div className="font-medium">Add a category first</div>
          <p className="opacity-80 mt-2">
            Products must belong to a category. Create at least one category, then return here.
          </p>
          <Link
            href="/product-categories"
            className="inline-block mt-3 text-sm underline underline-offset-4"
          >
            Go to product categories
          </Link>
        </div>
      ) : (
        <form
          action={async (formData) => {
            await saveProductAction(formData);
            const isCreate = !String(formData.get("productId") ?? "").trim();
            if (isCreate) reset();
          }}
          className="space-y-4 max-w-xl"
        >
          {editingId != null ? (
            <input type="hidden" name="productId" value={String(editingId)} />
          ) : null}

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="productName">
              Product name
            </label>
            <input
              id="productName"
              name="productName"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              required
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="productCode">
              Product code (optional)
            </label>
            <input
              id="productCode"
              name="productCode"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="productCatId">
              Category
            </label>
            <select
              id="productCatId"
              name="productCatId"
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              value={productCatIdForSelect}
              onChange={(e) => setProductCatId(e.target.value)}
              required
            >
              {categories.map((c) => (
                <option key={c.productCatId} value={c.productCatId}>
                  {c.productCat} ({c.productCode})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
              {editingId != null ? "Save product" : "Add product"}
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
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">All products</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-4">Product</div>
            <div className="col-span-3">Category</div>
            <div className="col-span-2">Code</div>
            <div className="col-span-3">Actions</div>
          </div>

          {products.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No products yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {products.map((p) => (
                <li
                  key={p.productId}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="col-span-4 font-medium truncate">{p.productName}</div>
                  <div className="col-span-3 truncate opacity-80">{p.productCat.productCat}</div>
                  <div className="col-span-2 truncate opacity-70">{p.productCode ?? "—"}</div>
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      disabled={categories.length === 0}
                      className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingDelete({ id: p.productId, name: p.productName })
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
        <div className="text-xs opacity-70">Showing {products.length} product(s).</div>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this product?"
          description={`“${pendingDelete.name}” will be removed permanently. You cannot undo this action.`}
          confirmLabel="Delete product"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("productId", String(pendingDelete.id));
            await deleteProductAction(fd);
            setPendingDelete(null);
            reset();
          }}
        />
      ) : null}
    </div>
  );
}
