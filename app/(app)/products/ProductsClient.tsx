"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductForm } from "@prisma/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PRODUCT_FORM_OPTIONS, productFormLabel } from "@/lib/product-form";

type ProductCatOption = {
  productCatId: number;
  productCat: string;
  productCode: string;
};

type CommercialOption = {
  id: string;
  name: string;
  invoicePrefix: string;
  isActive: boolean;
};

type ProductRow = {
  productId: number;
  productName: string;
  productCode: string | null;
  productCatId: number;
  form: ProductForm;
  commercialServiceId: string | null;
  productCat: { productCatId: number; productCat: string };
  commercialService: { id: string; name: string; invoicePrefix: string } | null;
};

const inputClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm";
const selectClass = inputClass;
const labelClass = "text-xs font-medium";
const hintClass = "text-[11px] opacity-70 mt-0.5";
const fieldRowClass = "flex items-start gap-2";
const fieldLabelClass = [
  labelClass,
  "shrink-0 w-[7.25rem] h-8",
  "flex items-center justify-end px-2",
  "rounded-md border border-border",
  "bg-sidebar text-sidebar-foreground",
].join(" ");
const fieldControlClass = "min-w-0 flex-1";

export function ProductsClient(props: {
  categories: ProductCatOption[];
  commercialServices: CommercialOption[];
  products: ProductRow[];
  canPickCommercialLine: boolean;
  defaultCommercialServiceId: string | null;
  assignedLineLabel: string | null;
  canManageProducts: boolean;
  saveProductAction: (formData: FormData) => void | Promise<void>;
  deleteProductAction: (formData: FormData) => void | Promise<void>;
}) {
  const {
    categories,
    commercialServices,
    products,
    canPickCommercialLine,
    defaultCommercialServiceId,
    assignedLineLabel,
    canManageProducts,
    saveProductAction,
    deleteProductAction,
  } = props;

  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: number;
    name: string;
  } | null>(null);
  const [productName, setProductName] = React.useState("");
  const [productCode, setProductCode] = React.useState("");
  const [productCatId, setProductCatId] = React.useState(() =>
    String(categories[0]?.productCatId ?? ""),
  );
  const [form, setForm] = React.useState<ProductForm>("LOOSE");
  const [commercialServiceId, setCommercialServiceId] = React.useState(() =>
    canPickCommercialLine ? "" : (defaultCommercialServiceId ?? ""),
  );
  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);

  const productCatIdForSelect =
    editingId != null &&
    productCatId &&
    !categories.some((c) => String(c.productCatId) === productCatId)
      ? String(categories[0]?.productCatId ?? "")
      : productCatId;

  function resetForm(opts?: { clearBanner?: boolean }) {
    setEditingId(null);
    setProductName("");
    setProductCode("");
    setProductCatId(String(categories[0]?.productCatId ?? ""));
    setForm("LOOSE");
    setCommercialServiceId(
      canPickCommercialLine ? "" : (defaultCommercialServiceId ?? ""),
    );
    if (opts?.clearBanner !== false) setBanner(null);
  }

  function closeForm(opts?: { clearBanner?: boolean }) {
    setIsFormOpen(false);
    resetForm(opts);
  }

  function openAddForm() {
    resetForm();
    setBanner(null);
    setIsFormOpen(true);
  }

  function startEdit(p: ProductRow) {
    setEditingId(p.productId);
    setProductName(p.productName);
    setProductCode(p.productCode ?? "");
    setProductCatId(String(p.productCatId));
    setForm(p.form);
    setCommercialServiceId(
      p.commercialServiceId ??
        (canPickCommercialLine ? "" : (defaultCommercialServiceId ?? "")),
    );
    setBanner(null);
    setIsFormOpen(true);
  }

  async function onSaveForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManageProducts) {
      setBanner({
        type: "error",
        text: "You cannot manage products without a commercial line assignment.",
      });
      return;
    }
    if (categories.length === 0) {
      setBanner({ type: "error", text: "Add a product category first." });
      return;
    }

    setBanner(null);
    const fd = new FormData(e.currentTarget);
    if (editingId != null) fd.set("productId", String(editingId));
    fd.set("form", form);

    const wasEdit = editingId != null;
    try {
      await saveProductAction(fd);
      closeForm({ clearBanner: false });
      setBanner({
        type: "ok",
        text: wasEdit ? "Product updated." : "Product created.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save product.",
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="text-sm opacity-75">
          Individual items you sell. Categories are managed on a{" "}
          <Link
            href="/product-categories"
            className="underline underline-offset-4"
          >
            separate page
          </Link>
          .
        </p>
      </div>

      {!canManageProducts ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          No commercial line is assigned to your account. Ask an administrator
          to assign one before managing products.
        </div>
      ) : null}

      {categories.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-sm">
          <div className="font-medium">Add a category first</div>
          <p className="opacity-80 mt-2">
            Products must belong to a category. Create at least one category,
            then return here.
          </p>
          <Link
            href="/product-categories"
            className="inline-block mt-3 text-sm underline underline-offset-4"
          >
            Go to product categories
          </Link>
        </div>
      ) : null}

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

      {isFormOpen && canManageProducts && categories.length > 0 ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Edit product" : "Add product"}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeForm();
          }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => closeForm()}
          />

          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background text-foreground p-3 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold">
                {editingId ? "Edit product" : "Add product"}
              </div>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 text-xs"
                onClick={() => closeForm()}
              >
                X
              </button>
            </div>

            <form
              onSubmit={(e) => void onSaveForm(e)}
              className="mt-3 space-y-1.5 max-h-[min(28rem,calc(100vh-6rem))] overflow-y-auto pr-1"
            >
              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="productName">
                  Name
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="productName"
                    name="productName"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className={inputClass}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="productCode">
                  Code
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="productCode"
                    name="productCode"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                    className={inputClass}
                  />
                  <p className={hintClass}>Optional internal code.</p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="productCatId">
                  Category
                </label>
                <div className={fieldControlClass}>
                  <select
                    id="productCatId"
                    name="productCatId"
                    className={selectClass}
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
              </div>

              {canPickCommercialLine ? (
                <div className={fieldRowClass}>
                  <label
                    className={fieldLabelClass}
                    htmlFor="commercialServiceId"
                  >
                    Line
                  </label>
                  <div className={fieldControlClass}>
                    <select
                      id="commercialServiceId"
                      name="commercialServiceId"
                      className={selectClass}
                      value={commercialServiceId}
                      onChange={(e) => setCommercialServiceId(e.target.value)}
                    >
                      <option value="">Shared (all lines)</option>
                      {commercialServices.map((s) => (
                        <option key={s.id} value={s.id} disabled={!s.isActive}>
                          {s.name}
                          {!s.isActive ? " (inactive)" : ""} · {s.invoicePrefix}
                        </option>
                      ))}
                    </select>
                    <p className={hintClass}>
                      Leave shared until catalogs diverge by line.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    type="hidden"
                    name="commercialServiceId"
                    value={commercialServiceId}
                  />
                  <div className={fieldRowClass}>
                    <span className={fieldLabelClass}>Line</span>
                    <p
                      className={`${fieldControlClass} text-xs opacity-80 py-1.5`}
                    >
                      {assignedLineLabel ?? "Your assigned line"}
                    </p>
                  </div>
                </>
              )}

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="form">
                  Form
                </label>
                <div className={fieldControlClass}>
                  <select
                    id="form"
                    name="form"
                    className={selectClass}
                    value={form}
                    onChange={(e) => setForm(e.target.value as ProductForm)}
                  >
                    {PRODUCT_FORM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className={hintClass}>
                    {PRODUCT_FORM_OPTIONS.find((o) => o.value === form)?.hint}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
                >
                  {editingId ? "Save changes" : "Add product"}
                </button>
                <button
                  type="button"
                  onClick={() => closeForm()}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold">All products</h2>
          {canManageProducts && categories.length > 0 ? (
            <button
              type="button"
              className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
              onClick={openAddForm}
            >
              Add product
            </button>
          ) : null}
        </div>

        {products.length === 0 ? (
          <p className="text-sm opacity-75">No products yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">Product</th>
                  <th className="p-2 font-medium">Category</th>
                  <th className="p-2 font-medium">Line</th>
                  <th className="p-2 font-medium">Code</th>
                  <th className="p-2 font-medium w-28">Form</th>
                  <th className="p-2 font-medium w-36 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.productId}
                    className={[
                      "border-b border-border align-top",
                      editingId === p.productId ? "bg-accent/15" : "",
                    ].join(" ")}
                  >
                    <td className="p-2 font-medium">{p.productName}</td>
                    <td className="p-2 opacity-90">
                      {p.productCat.productCat}
                    </td>
                    <td
                      className="p-2 text-xs opacity-80 max-w-[8rem] truncate"
                      title={p.commercialService?.name ?? "Shared"}
                    >
                      {p.commercialService?.name ?? "Shared"}
                    </td>
                    <td className="p-2 text-xs opacity-80">
                      {p.productCode ?? "—"}
                    </td>
                    <td className="p-2 text-xs">
                      {productFormLabel(p.form)}
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        {canManageProducts && categories.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                          >
                            Edit
                          </button>
                        ) : null}
                        {canManageProducts ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingDelete({
                                id: p.productId,
                                name: p.productName,
                              })
                            }
                            className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10"
                          >
                            Delete
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
        <div className="text-xs opacity-70">
          Showing {products.length} product(s).
        </div>
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
            try {
              await deleteProductAction(fd);
              setPendingDelete(null);
              closeForm({ clearBanner: false });
              setBanner({ type: "ok", text: "Product deleted." });
              router.refresh();
            } catch (err) {
              setBanner({
                type: "error",
                text:
                  err instanceof Error
                    ? err.message
                    : "Could not delete product.",
              });
              setPendingDelete(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
