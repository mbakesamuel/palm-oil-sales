"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";
import { MAIN_PRODUCT_CATEGORY_ID } from "@/lib/pricing/constants";
import { CustomerType } from "@/lib/domain";

type ProductOpt = {
  productId: number;
  productName: string;
  productCatId: number;
};

type ScheduleRow = {
  id: string;
  productId: number;
  productName: string;
  productCatId: number;
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

function labelCustomerType(ct: string | null) {
  if (!ct) return "—";
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

export function ProductPricingClient(props: {
  companyName: string;
  department: string | null;
  logoUrl?: string | null;
  products: ProductOpt[];
  schedules: ScheduleRow[];
  saveScheduleAction: (formData: FormData) => void | Promise<void>;
  deleteScheduleAction: (formData: FormData) => void | Promise<void>;
}) {
  const {
    companyName,
    department,
    logoUrl,
    products,
    schedules,
    saveScheduleAction,
    deleteScheduleAction,
  } = props;
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [productId, setProductId] = React.useState("");
  const [customerType, setCustomerType] = React.useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = React.useState("");
  const [unitPriceExTax, setUnitPriceExTax] = React.useState("");
  const [banner, setBanner] = React.useState<{ type: "error" | "ok"; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    label: string;
  } | null>(null);

  const selectedCatId = products.find((p) => String(p.productId) === productId)?.productCatId;
  const isMainProduct = selectedCatId === MAIN_PRODUCT_CATEGORY_ID;

  function resetForm() {
    setEditingId(null);
    setProductId("");
    setCustomerType("");
    setEffectiveFrom("");
    setUnitPriceExTax("");
  }

  function closeForm() {
    setIsFormOpen(false);
    resetForm();
  }

  function openAddForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function startEdit(row: ScheduleRow) {
    setEditingId(row.id);
    setProductId(String(row.productId));
    setCustomerType(row.customerType ?? "");
    setEffectiveFrom(row.effectiveFromIso);
    setUnitPriceExTax(row.unitPriceExTax);
    setIsFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="hidden print:block">
        <ReportHeader
          companyName={companyName}
          department={department}
          logoSrc={logoUrl}
          title="Product pricing"
        />
      </div>

      <div className="space-y-1 print:hidden">
        <h1 className="text-2xl font-semibold">Product pricing</h1>
        <p className="text-sm opacity-75">
          Ex-tax unit prices by effective date.{" "}
          <span className="font-medium">Main</span> category products (category id{" "}
          {MAIN_PRODUCT_CATEGORY_ID}) are priced per customer type; other categories use one direct
          price per product. Operational screens resolve the latest row on or before the document
          date. Only administrators can edit this page. Prices are those approved by the General Manager of the corporation.
        </p>
        <p className="text-sm opacity-75">
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
      </div>

      {products.length === 0 ? ( 
        <div className="rounded-lg border border-border p-4 text-sm">
          Add products before scheduling price effective date.
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          <PrintButton label="Print report" />
          <button
            type="button"
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
            onClick={() => {
              setBanner(null);
              openAddForm();
            }}
          >
            Add price row
          </button>
        {/*   <p className="text-xs opacity-75">Create or edit scheduled unit prices.</p> */}
        </div>
      )}

      {banner ? (
        <div
          className={
            banner.type === "error"
              ? "rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm"
              : "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 print:hidden"
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
            onClick={closeForm}
          />

          <div className="relative mx-auto mt-24 w-[min(42rem,calc(100vw-2rem))] rounded-lg border border-border bg-background text-foreground p-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="font-medium">{editingId ? "Edit price row" : "Add price row"}</div>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-sm"
                onClick={closeForm}
              >
                Close
              </button>
            </div>

            <form
              className="mt-4 space-y-4"
              action={async (formData) => {
                setBanner(null);
                try {
                  const wasEditing = editingId != null;
                  await saveScheduleAction(formData);
                  closeForm();
                  router.refresh();
                  setBanner({
                    type: "ok",
                    text: wasEditing ? "Price updated." : "Price added.",
                  });
                } catch (e) {
                  setBanner({
                    type: "error",
                    text: e instanceof Error ? e.message : "Could not save.",
                  });
                }
              }}
            >
              {editingId ? <input type="hidden" name="id" value={editingId} /> : null}

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="pp-product">
                  Product
                </label>
                <select
                  id="pp-product"
                  name="productId"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2"
                  required
                >
                  <option value="" disabled>
                    Select a product…
                  </option>
                  {products.map((p) => (
                    <option key={p.productId} value={String(p.productId)}>
                      {p.productName} (cat {p.productCatId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="pp-customer-type">
                  Customer type
                </label>
                {!isMainProduct ? <input type="hidden" name="customerType" value="" /> : null}
                <select
                  id="pp-customer-type"
                  name="customerType"
                  value={isMainProduct ? customerType : ""}
                  onChange={(e) => setCustomerType(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2"
                  disabled={!productId || !isMainProduct}
                  required={!!productId && isMainProduct}
                >
                  <option value="" disabled>
                    {!productId
                      ? "Select a product first…"
                      : isMainProduct
                        ? "Select a customer type…"
                        : "Only for Main-category products"}
                  </option>
                  {CUSTOMER_TYPE_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {labelCustomerType(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="pp-effective">
                  Effective from
                </label>
                <input
                  id="pp-effective"
                  name="effectiveFrom"
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2"
                  required
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="pp-price">
                  Unit price (ex tax)
                </label>
                <input
                  id="pp-price"
                  name="unitPriceExTax"
                  value={unitPriceExTax}
                  onChange={(e) => setUnitPriceExTax(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2"
                  inputMode="decimal"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
                >
                  {editingId ? "Save changes" : "Add"}
                </button>
                {editingId ? (
                  <button
                    type="button"
                    className="rounded-md border border-border px-4 py-2 text-sm"
                    onClick={resetForm}
                  >
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Scheduled prices</h2>
        {schedules.length === 0 ? (
          <p className="text-sm opacity-75">No rows yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">Product</th>
                  <th className="p-2 font-medium">Customer type</th>
                  <th className="p-2 font-medium">Effective from</th>
                  <th className="p-2 font-medium">Ex-tax unit</th>
                  <th className="p-2 font-medium w-40 print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border align-top"
                  >
                    <td className="p-2">{r.productName}</td>
                    <td className="p-2">{labelCustomerType(r.customerType)}</td>
                    <td className="p-2 tabular-nums">{r.effectiveFromIso}</td>
                    <td className="p-2 tabular-nums">{r.unitPriceExTax}</td>
                    <td className="p-2 print:hidden">
                      <div className="flex flex-wrap gap-5">
                        <button
                          type="button"
                          className="text-xs underline underline-offset-4"
                          onClick={() => startEdit(r)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs underline underline-offset-4 text-red-600 dark:text-red-400"
                          onClick={() =>
                            setPendingDelete({
                              id: r.id,
                              label: `${r.productName} · ${labelCustomerType(r.customerType)} · ${r.effectiveFromIso}`,
                            })
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
              if (editingId === id) resetForm();
              router.refresh();
              setBanner({ type: "ok", text: "Price row deleted." });
            } catch (e) {
              setBanner({
                type: "error",
                text: e instanceof Error ? e.message : "Could not delete.",
              });
            }
          }}
        />
      ) : null}
    </div>
  );
}
