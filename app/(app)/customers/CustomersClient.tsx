"use client";

import * as React from "react";
import type { CustomerResidency, CustomerType } from "@/lib/domain";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SkeletonTable } from "@/components/SkeletonTable";
import { NO_TAX_REGIME_LABEL, NO_TAX_REGIME_VALUE } from "@/lib/customers/constants";

type TaxRegime = {
  id: string;
  name: string;
  vatApplies: boolean;
  commercialServiceId: string | null;
};
type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  customerType: CustomerType;
  residency: CustomerResidency;
  taxpayerId: string | null;
  commercialServiceId: string;
  commercialService: { id: string; name: string };
  taxRegime: { id: string; name: string; vatApplies: boolean } | null;
  createdAtIso: string;
};

function taxRegimesForLine(
  regimes: TaxRegime[],
  commercialServiceId: string,
): TaxRegime[] {
  return regimes.filter(
    (r) => r.commercialServiceId == null || r.commercialServiceId === commercialServiceId,
  );
}

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

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  INDUSTRY: "Industry",
  WHOLE_SALE: "Whole sale",
  RETAIL: "Retail",
  WORKER: "Worker",
};

export function CustomersClient(props: {
  scopeMode: "all" | "single" | "none";
  defaultCommercialServiceId: string;
  commercialServices: Array<{ id: string; name: string; code: string }>;
  taxRegimes: TaxRegime[];
  customers: CustomerRow[];
  saveCustomerAction: (formData: FormData) => void | Promise<void>;
  deleteCustomerAction: (formData: FormData) => void | Promise<void>;
}) {
  const {
    scopeMode,
    defaultCommercialServiceId,
    commercialServices,
    taxRegimes,
    customers,
    saveCustomerAction,
    deleteCustomerAction,
  } = props;
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);
  const [form, setForm] = React.useState({
    commercialServiceId: defaultCommercialServiceId,
    name: "",
    phone: "",
    email: "",
    address: "",
    customerType: "INDUSTRY" as CustomerType,
    residency: "LOCAL" as CustomerResidency,
    taxRegimeId: NO_TAX_REGIME_VALUE,
    taxpayerId: "",
  });

  const regimesForSelectedLine = React.useMemo(
    () => taxRegimesForLine(taxRegimes, form.commercialServiceId),
    [taxRegimes, form.commercialServiceId],
  );

  const hasTaxRegime = form.taxRegimeId !== NO_TAX_REGIME_VALUE;

  const taxRegimeIdForSelect = form.taxRegimeId;

  const canManageCustomers =
    scopeMode !== "none" && commercialServices.length > 0;

  function resetForm(opts?: { clearBanner?: boolean }) {
    setEditingId(null);
    const lineId = defaultCommercialServiceId;
    setForm({
      commercialServiceId: lineId,
      name: "",
      phone: "",
      email: "",
      address: "",
      customerType: "INDUSTRY",
      residency: "LOCAL",
      taxRegimeId: NO_TAX_REGIME_VALUE,
      taxpayerId: "",
    });
    if (opts?.clearBanner !== false) setBanner(null);
  }

  function closeForm(opts?: { clearBanner?: boolean }) {
    setIsFormOpen(false);
    resetForm(opts);
  }

  function openAddForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function startEdit(row: CustomerRow) {
    setEditingId(row.id);
    const taxpayerId = row.taxpayerId ?? "";
    setForm({
      commercialServiceId: row.commercialServiceId,
      name: row.name,
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      customerType: row.customerType,
      residency: row.residency,
      taxRegimeId: row.taxRegime?.id ?? NO_TAX_REGIME_VALUE,
      taxpayerId,
    });
    setBanner(null);
    setIsFormOpen(true);
  }

  async function onSaveForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (
      hasTaxRegime &&
      !regimesForSelectedLine.some((r) => r.id === form.taxRegimeId)
    ) {
      setBanner({ type: "error", text: "Please select a valid tax regime." });
      return;
    }
    setBanner(null);
    const wasEdit = editingId != null;
    try {
      const fd = new FormData(e.currentTarget);
      if (editingId) fd.set("id", editingId);
      await saveCustomerAction(fd);
      closeForm({ clearBanner: false });
      setBanner({
        type: "ok",
        text: wasEdit ? "Customer updated." : "Customer created.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save customer.",
      });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("id", pendingDelete.id);
      await deleteCustomerAction(fd);
      setPendingDelete(null);
      if (editingId === pendingDelete.id) closeForm({ clearBanner: false });
      setBanner({ type: "ok", text: "Customer deleted." });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not delete customer.",
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm opacity-75">
          Customers belong to one commercial line. Tax and pricing rules follow each
          line&apos;s regimes (palm oil, rubber, BPO, etc.).
        </p>
      </div>

      {scopeMode === "none" ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          No commercial line is assigned to your account. Ask an administrator to
          assign one before managing customers.
        </div>
      ) : null}

      {taxRegimes.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-sm opacity-90">
          <p>
            No line-specific tax regimes yet. You can still add customers with{" "}
            <span className="font-medium">{NO_TAX_REGIME_LABEL}</span>, or create regimes
            under{" "}
            <Link className="underline underline-offset-4" href="/tax-regimes">
              Tax regimes
            </Link>
            .
          </p>
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

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Edit customer" : "Add customer"}
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
                {editingId ? "Edit customer" : "Add customer"}
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
              {editingId ? <input type="hidden" name="id" value={editingId} /> : null}
              {!hasTaxRegime ? (
                <input type="hidden" name="taxpayerId" value="" />
              ) : null}
              {scopeMode === "single" ? (
                <input
                  type="hidden"
                  name="commercialServiceId"
                  value={form.commercialServiceId}
                />
              ) : null}

              {scopeMode === "all" && !editingId ? (
                <div className={fieldRowClass}>
                  <label className={fieldLabelClass} htmlFor="commercialServiceId">
                    Line
                  </label>
                  <div className={fieldControlClass}>
                    <select
                      id="commercialServiceId"
                      name="commercialServiceId"
                      className={selectClass}
                      value={form.commercialServiceId}
                      onChange={(e) => {
                        const lineId = e.target.value;
                        const lineRegimes = taxRegimesForLine(taxRegimes, lineId);
                        setForm((p) => ({
                          ...p,
                          commercialServiceId: lineId,
                          taxRegimeId: NO_TAX_REGIME_VALUE,
                          taxpayerId: "",
                        }));
                      }}
                      required
                    >
                      <option value="">Select line…</option>
                      {commercialServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : scopeMode === "all" && editingId ? (
                <input
                  type="hidden"
                  name="commercialServiceId"
                  value={form.commercialServiceId}
                />
              ) : null}

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="name">
                  Name
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className={inputClass}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="phone">
                  Phone
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="phone"
                    name="phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    className={inputClass}
                  />
                  <p className={hintClass}>Optional.</p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="email">
                  Email
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                    className={inputClass}
                  />
                  <p className={hintClass}>Optional.</p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="address">
                  Address
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="address"
                    name="address"
                    value={form.address}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, address: e.target.value }))
                    }
                    className={inputClass}
                  />
                  <p className={hintClass}>Optional.</p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="customerType">
                  Type
                </label>
                <div className={fieldControlClass}>
                  <select
                    id="customerType"
                    name="customerType"
                    value={form.customerType}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        customerType: e.target.value as CustomerType,
                      }))
                    }
                    className={selectClass}
                  >
                    <option value="INDUSTRY">Industry</option>
                    <option value="WHOLE_SALE">Whole sale</option>
                    <option value="RETAIL">Retail</option>
                    <option value="WORKER">Worker</option>
                  </select>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="residency">
                  Location
                </label>
                <div className={fieldControlClass}>
                  <select
                    id="residency"
                    name="residency"
                    value={form.residency}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        residency: e.target.value as CustomerResidency,
                      }))
                    }
                    className={selectClass}
                  >
                    <option value="LOCAL">Local</option>
                    <option value="OVERSEAS">Overseas</option>
                  </select>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="taxRegimeId">
                  Tax regime
                </label>
                <div className={fieldControlClass}>
                  <select
                    id="taxRegimeId"
                    name="taxRegimeId"
                    value={taxRegimeIdForSelect}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((p) => ({
                        ...p,
                        taxRegimeId: value,
                        taxpayerId: value === NO_TAX_REGIME_VALUE ? "" : p.taxpayerId,
                      }));
                    }}
                    className={selectClass}
                  >
                    <option value={NO_TAX_REGIME_VALUE}>{NO_TAX_REGIME_LABEL}</option>
                    {regimesForSelectedLine.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.name} ({tr.vatApplies ? "VAT applies" : "VAT exempt"})
                      </option>
                    ))}
                  </select>
                  <p className={hintClass}>
                    {hasTaxRegime
                      ? "A tax regime means the customer is a registered taxpayer."
                      : "No regime uses the no-TPN sales tax rate (10% SAT when applicable)."}
                  </p>
                </div>
              </div>

              {hasTaxRegime ? (
                <div className={fieldRowClass}>
                  <label className={fieldLabelClass} htmlFor="taxpayerId">
                    Tax ID
                  </label>
                  <div className={fieldControlClass}>
                    <input
                      id="taxpayerId"
                      name="taxpayerId"
                      value={form.taxpayerId}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, taxpayerId: e.target.value }))
                      }
                      className={inputClass}
                    />
                    <p className={hintClass}>
                      Taxpayer card number (optional). Leave blank if unknown.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]">
                <button
                  type="submit"
                  disabled={!canManageCustomers}
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  {editingId ? "Save changes" : "Add customer"}
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
          <h2 className="text-lg font-semibold">All customers</h2>
          <button
            type="button"
            disabled={!canManageCustomers}
            onClick={openAddForm}
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add customer
          </button>
        </div>

        {customers.length === 0 ? (
          <SkeletonTable
            emptyMessage="No customers yet."
            columns={[
              { label: "Name", skeleton: "wide" },
              ...(scopeMode === "all" ? [{ label: "Line" }] : []),
              { label: "Phone" },
              { label: "Type" },
              { label: "Location" },
              { label: "Regime" },
              { label: "Tax ID" },
              { label: "Actions", className: "w-36 text-right", skeleton: "narrow" },
            ]}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">Name</th>
                  {scopeMode === "all" ? (
                    <th className="p-2 font-medium">Line</th>
                  ) : null}
                  <th className="p-2 font-medium">Phone</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium">Location</th>
                  <th className="p-2 font-medium">Regime</th>
                  <th className="p-2 font-medium">Tax ID</th>
                  <th className="p-2 font-medium w-36 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className={[
                      "border-b border-border align-top",
                      editingId === c.id ? "bg-accent/15" : "",
                    ].join(" ")}
                  >
                    <td className="p-2 font-medium">{c.name}</td>
                    {scopeMode === "all" ? (
                      <td className="p-2 text-xs opacity-80">{c.commercialService.name}</td>
                    ) : null}
                    <td className="p-2 text-xs opacity-80">{c.phone ?? "—"}</td>
                    <td className="p-2 text-xs opacity-80">
                      {CUSTOMER_TYPE_LABELS[c.customerType] ?? c.customerType}
                    </td>
                    <td className="p-2 text-xs opacity-80">
                      {c.residency === "OVERSEAS" ? "Overseas" : "Local"}
                    </td>
                    <td className="p-2 text-xs opacity-80">
                      {c.taxRegime?.name ?? NO_TAX_REGIME_LABEL}
                    </td>
                    <td className="p-2 text-xs opacity-80">
                      {c.taxRegime ? (c.taxpayerId ?? "—") : "—"}
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
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
                            setPendingDelete({ id: c.id, name: c.name })
                          }
                          className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10"
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
        <p className="text-xs opacity-70">
          Showing {customers.length} customer(s). Dates are stored but not displayed
          in the table.
        </p>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this customer?"
          description={`“${pendingDelete.name}” will be removed permanently. You cannot undo this action.`}
          confirmLabel="Delete customer"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
