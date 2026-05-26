"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";
import { CustomerType } from "@/lib/domain";

type ProductOpt = {
  productId: number;
  productName: string;
  productCatId: number;
  productCatName: string;
  isMainCategory: boolean;
};

type ScheduleRow = {
  id: string;
  productId: number;
  productName: string;
  productCatId: number;
  isMainCategory: boolean;
  customerType: string | null;
  effectiveFromIso: string;
  unitPriceExTax: string;
};

const CUSTOMER_TYPE_OPTIONS = [
  CustomerType.INDUSTRY,
  CustomerType.WHOLE_SALE,
  CustomerType.RETAIL,
  CustomerType.WORKER,
] as const;

const inputClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm";
const selectClass = inputClass;
const hintClass = "text-[11px] opacity-70 mt-0.5";
const fieldRowClass = "flex items-start gap-2";
const fieldLabelClass = [
  "text-xs font-medium",
  "shrink-0 w-[7.25rem] h-8",
  "flex items-center justify-end px-2",
  "rounded-md border border-border",
  "bg-sidebar text-sidebar-foreground",
].join(" ");
const fieldControlClass = "min-w-0 flex-1";

function labelCustomerType(ct: string | null) {
  if (!ct) return "Direct price";
  switch (ct) {
    case CustomerType.INDUSTRY:
      return "Industry";
    case CustomerType.WHOLE_SALE:
      return "Wholesale";
    case CustomerType.RETAIL:
      return "Retail";
    case CustomerType.WORKER:
      return "Worker";
    default:
      return ct;
  }
}

/** Canonical order for customer-type sub-rows within a product group. */
const CUSTOMER_TYPE_RANK: Record<string, number> = {
  [CustomerType.INDUSTRY]: 0,
  [CustomerType.WHOLE_SALE]: 1,
  [CustomerType.RETAIL]: 2,
  [CustomerType.WORKER]: 3,
};

function customerTypeRank(ct: string | null): number {
  if (!ct) return -1;
  return CUSTOMER_TYPE_RANK[ct] ?? 99;
}

type ScheduleGroup = {
  productId: number;
  productName: string;
  /** Latest effective date across all rows of this product. */
  effectiveFromIso: string;
  rows: ScheduleRow[];
};

function groupSchedulesByProduct(rows: ScheduleRow[]): ScheduleGroup[] {
  const byProduct = new Map<number, ScheduleGroup>();
  for (const r of rows) {
    const existing = byProduct.get(r.productId);
    if (!existing) {
      byProduct.set(r.productId, {
        productId: r.productId,
        productName: r.productName,
        effectiveFromIso: r.effectiveFromIso,
        rows: [r],
      });
      continue;
    }
    existing.rows.push(r);
    if (r.effectiveFromIso > existing.effectiveFromIso) {
      existing.effectiveFromIso = r.effectiveFromIso;
    }
  }
  const groups = [...byProduct.values()];
  for (const g of groups) {
    g.rows.sort(
      (a, b) => customerTypeRank(a.customerType) - customerTypeRank(b.customerType),
    );
  }
  groups.sort((a, b) =>
    a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" }),
  );
  return groups;
}

export function ProductPricingClient(props: {
  companyName: string;
  department: string | null;
  logoUrl?: string | null;
  products: ProductOpt[];
  schedules: ScheduleRow[];
  saveScheduleAction: (formData: FormData) => void | Promise<void>;
  deleteScheduleAction: (formData: FormData) => void | Promise<void>;
  /** When true, omit page title (used inside ProductPricingHub). */
  embedded?: boolean;
}) {
  const {
    companyName,
    department,
    logoUrl,
    products,
    schedules,
    saveScheduleAction,
    deleteScheduleAction,
    embedded = false,
  } = props;
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [productId, setProductId] = React.useState("");
  const [customerType, setCustomerType] = React.useState("");
  const [effectiveFrom, setEffectiveFrom] = React.useState("");
  const [unitPriceExTax, setUnitPriceExTax] = React.useState("");
  const [banner, setBanner] = React.useState<{ type: "error" | "ok"; text: string } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    label: string;
  } | null>(null);

  const selectedProduct = products.find(
    (p) => String(p.productId) === productId,
  );
  const isMainProduct = selectedProduct?.isMainCategory === true;

  const scheduleGroups = React.useMemo(
    () => groupSchedulesByProduct(schedules),
    [schedules],
  );

  /** Distinct categories present in the product list, sorted by name. */
  const categoryOptions = React.useMemo(() => {
    const byId = new Map<number, { id: number; name: string }>();
    for (const p of products) {
      if (!byId.has(p.productCatId)) {
        byId.set(p.productCatId, { id: p.productCatId, name: p.productCatName });
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [products]);

  /** Empty set = "no filter, show all categories". */
  const [selectedCatIds, setSelectedCatIds] = React.useState<Set<number>>(
    () => new Set(),
  );

  const filteredProducts = React.useMemo(() => {
    if (selectedCatIds.size === 0) return products;
    return products.filter((p) => selectedCatIds.has(p.productCatId));
  }, [products, selectedCatIds]);

  /**
   * If the currently-picked product drops out of the filtered list (e.g. user
   * unticked its category), clear the selection so the user has to re-pick.
   */
  React.useEffect(() => {
    if (!productId) return;
    if (filteredProducts.some((p) => String(p.productId) === productId)) return;
    setProductId("");
    setCustomerType("");
  }, [filteredProducts, productId]);

  function toggleCategoryFilter(catId: number) {
    setSelectedCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function clearCategoryFilter() {
    setSelectedCatIds(new Set());
  }

  function resetForm(opts?: { clearBanner?: boolean }) {
    setEditingId(null);
    setProductId("");
    setCustomerType("");
    setEffectiveFrom("");
    setUnitPriceExTax("");
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

  function startEdit(row: ScheduleRow) {
    setEditingId(row.id);
    setProductId(String(row.productId));
    setCustomerType(row.customerType ?? "");
    setEffectiveFrom(row.effectiveFromIso);
    setUnitPriceExTax(row.unitPriceExTax);
    setBanner(null);
    setSelectedCatIds(new Set());
    setIsFormOpen(true);
  }

  async function onSaveForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (products.length === 0) {
      setBanner({ type: "error", text: "Add products before scheduling prices." });
      return;
    }

    setBanner(null);
    const fd = new FormData(e.currentTarget);
    if (editingId) fd.set("id", editingId);
    if (!isMainProduct) fd.set("customerType", "");

    const wasEdit = editingId != null;
    try {
      await saveScheduleAction(fd);
      closeForm({ clearBanner: false });
      setBanner({
        type: "ok",
        text: wasEdit ? "Price row updated." : "Price row added.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save price row.",
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="hidden print:block">
        <ReportHeader
          companyName={companyName}
          department={department}
          logoSrc={logoUrl}
          title="Product pricing"
        />
      </div>

      {!embedded ? (
        <div className="space-y-1 print:hidden">
          <h1 className="text-2xl font-semibold">Product pricing</h1>
          <p className="text-sm opacity-75">
            Ex-tax unit prices by effective date. Products in the{" "}
            <span className="font-medium">Main</span> category are priced per
            customer type; other categories use one direct price per product.
          </p>
        </div>
      ) : (
        <p className="text-sm opacity-75 print:hidden">
          The <span className="font-medium">Main</span> category uses
          customer-type segments; other categories use one price per product.
          Bottled SKUs use a single direct price per product (no customer-type
          column).
        </p>
      )}
      <p className="text-sm opacity-75 print:hidden">
        Manage the catalog under{" "}
        <Link href="/products" className="underline underline-offset-4">
          Products
        </Link>{" "}
        and{" "}
        <Link href="/product-categories" className="underline underline-offset-4">
          Product categories
        </Link>
        .
      </p>

      {products.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-sm print:hidden">
          <div className="font-medium">Add products first</div>
          <p className="opacity-80 mt-2">
            Create products before scheduling price effective dates.
          </p>
          <Link
            href="/products"
            className="inline-block mt-3 text-sm underline underline-offset-4"
          >
            Go to products
          </Link>
        </div>
      ) : null}

      {banner ? (
        <div
          className={
            banner.type === "error"
              ? "rounded-lg border border-red-600/40 bg-red-600/5 px-4 py-3 text-sm text-red-800 dark:text-red-300 print:hidden"
              : "rounded-lg border border-emerald-600/40 bg-emerald-600/5 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200 print:hidden"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {isFormOpen && products.length > 0 ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Edit price row" : "Add price row"}
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
                {editingId ? "Edit price row" : "Add price row"}
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
              {categoryOptions.length > 1 ? (
                <div className={fieldRowClass}>
                  <span className={fieldLabelClass}>Filter</span>
                  <div className={fieldControlClass}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {categoryOptions.map((c) => (
                        <label
                          key={c.id}
                          className="inline-flex items-center gap-1.5 text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCatIds.has(c.id)}
                            onChange={() => toggleCategoryFilter(c.id)}
                            className="size-3.5"
                          />
                          {c.name}
                        </label>
                      ))}
                      {selectedCatIds.size > 0 ? (
                        <button
                          type="button"
                          onClick={clearCategoryFilter}
                          className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                    <p className={hintClass}>
                      {selectedCatIds.size === 0
                        ? "Tick any category to narrow the product list below."
                        : `Showing ${filteredProducts.length} of ${products.length} products.`}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="pp-product">
                  Product
                </label>
                <div className={fieldControlClass}>
                  <select
                    id="pp-product"
                    name="productId"
                    value={productId}
                    onChange={(e) => {
                      setProductId(e.target.value);
                      const picked = products.find(
                        (p) => String(p.productId) === e.target.value,
                      );
                      if (!picked?.isMainCategory) setCustomerType("");
                    }}
                    className={selectClass}
                    required
                    autoFocus
                  >
                    <option value="" disabled>
                      {filteredProducts.length === 0
                        ? "No products match the selected categories"
                        : "Select product…"}
                    </option>
                    {filteredProducts.map((p) => (
                      <option key={p.productId} value={String(p.productId)}>
                        {p.productName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="pp-customer-type">
                  Cust. type
                </label>
                <div className={fieldControlClass}>
                  {!isMainProduct ? (
                    <input type="hidden" name="customerType" value="" />
                  ) : null}
                  <select
                    id="pp-customer-type"
                    name="customerType"
                    value={isMainProduct ? customerType : ""}
                    onChange={(e) => setCustomerType(e.target.value)}
                    className={selectClass}
                    disabled={!productId || !isMainProduct}
                    required={!!productId && isMainProduct}
                  >
                    <option value="" disabled>
                      {!productId
                        ? "Select product first…"
                        : isMainProduct
                          ? "Select type…"
                          : "N/A (not Main category)"}
                    </option>
                    {CUSTOMER_TYPE_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {labelCustomerType(c)}
                      </option>
                    ))}
                  </select>
                  <p className={hintClass}>
                    Required for Main category products only.
                  </p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="pp-effective">
                  Effective
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="pp-effective"
                    name="effectiveFrom"
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="pp-price">
                  Ex-tax unit
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="pp-price"
                    name="unitPriceExTax"
                    value={unitPriceExTax}
                    onChange={(e) => setUnitPriceExTax(e.target.value)}
                    className={inputClass}
                    inputMode="decimal"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
                >
                  {editingId ? "Save changes" : "Add price row"}
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

      <section className="space-y-2 -mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 print:hidden">
          <h2 className="text-lg font-semibold">Scheduled prices</h2>
          {products.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <PrintButton label="Print report" />
              <button
                type="button"
                className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
                onClick={openAddForm}
              >
                Add price row
              </button>
            </div>
          ) : null}
        </div>

        {schedules.length === 0 ? (
          <p className="text-sm opacity-75">No price rows yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">Customer type</th>
                  <th className="p-2 font-medium text-right">Ex-tax unit</th>
                  <th className="p-2 font-medium w-36 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>
                {scheduleGroups.map((g) => (
                  <React.Fragment key={g.productId}>
                    <tr className="bg-foreground/6 border-b border-border print:bg-black/4">
                      <td colSpan={3} className="p-2 font-semibold">
                        <span>{g.productName}</span>
                        <span className="ml-2 text-xs font-normal opacity-70 tabular-nums">
                          — Effective from {g.effectiveFromIso}
                        </span>
                      </td>
                    </tr>
                    {g.rows.map((r) => (
                      <tr
                        key={r.id}
                        className={[
                          "border-b border-border align-top",
                          editingId === r.id ? "bg-accent/15" : "",
                        ].join(" ")}
                      >
                        <td className="p-2 pl-6 opacity-90">
                          {labelCustomerType(r.customerType)}
                        </td>
                        <td className="p-2 tabular-nums text-right">
                          {r.unitPriceExTax}
                        </td>
                        <td className="p-2 text-right print:hidden">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {products.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => startEdit(r)}
                                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                              >
                                Edit
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() =>
                                setPendingDelete({
                                  id: r.id,
                                  label: `${r.productName} · ${labelCustomerType(r.customerType)} · ${r.effectiveFromIso}`,
                                })
                              }
                              className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-xs opacity-70">
          Showing {schedules.length} price row{schedules.length === 1 ? "" : "s"} across{" "}
          {scheduleGroups.length} product
          {scheduleGroups.length === 1 ? "" : "s"}.
        </div>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete price row?"
          description={`Remove scheduled price: ${pendingDelete.label}`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const id = pendingDelete.id;
            setPendingDelete(null);
            setBanner(null);
            try {
              const fd = new FormData();
              fd.set("id", id);
              await deleteScheduleAction(fd);
              if (editingId === id) closeForm({ clearBanner: false });
              setBanner({ type: "ok", text: "Price row deleted." });
              router.refresh();
            } catch (err) {
              setBanner({
                type: "error",
                text: err instanceof Error ? err.message : "Could not delete price row.",
              });
            }
          }}
        />
      ) : null}
    </div>
  );
}
