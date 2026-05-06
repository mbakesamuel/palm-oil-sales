"use client";

import * as React from "react";
import type { CustomerResidency, CustomerType } from "@/lib/domain";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type TaxRegime = { id: string; name: string; vatApplies: boolean };
type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  customerType: CustomerType;
  residency: CustomerResidency;
  hasTaxpayerId: boolean;
  taxpayerId: string | null;
  taxRegime: { id: string; name: string; vatApplies: boolean };
  createdAtIso: string;
};

export function CustomersClient(props: {
  taxRegimes: TaxRegime[];
  customers: CustomerRow[];
  saveCustomerAction: (formData: FormData) => void | Promise<void>;
  deleteCustomerAction: (formData: FormData) => void | Promise<void>;
}) {
  const { taxRegimes, customers, saveCustomerAction, deleteCustomerAction } =
    props;

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    customerType: "INDUSTRY" as CustomerType,
    residency: "LOCAL" as CustomerResidency,
    taxRegimeId: taxRegimes[0]?.id ?? "",
    hasTaxpayerId: false,
    taxpayerId: "",
  });

  function resetToCreate() {
    setEditingId(null);
    setForm({
      name: "",
      phone: "",
      email: "",
      address: "",
      customerType: "INDUSTRY",
      residency: "LOCAL",
      taxRegimeId: taxRegimes[0]?.id ?? "",
      hasTaxpayerId: false,
      taxpayerId: "",
    });
  }

  const taxRegimeIdForSelect = form.taxRegimeId || taxRegimes[0]?.id || "";

  const closeModal = React.useCallback(() => {
    setModalOpen(false);
    resetToCreate();
  }, [taxRegimes]);

  React.useEffect(() => {
    if (!modalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [modalOpen, closeModal]);

  function openCreate() {
    resetToCreate();
    setModalOpen(true);
  }

  function startEdit(row: CustomerRow) {
    setEditingId(row.id);
    const taxpayerId = row.taxpayerId ?? "";
    setForm({
      name: row.name,
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      customerType: row.customerType,
      residency: row.residency,
      taxRegimeId: row.taxRegime.id,
      hasTaxpayerId: row.hasTaxpayerId,
      taxpayerId,
    });
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm opacity-75">
          VAT is applied automatically based on each customer’s tax regime.
        </p>
      </div>

      {taxRegimes.length === 0 ? (
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 text-sm">
          <div className="font-medium">Tax regimes required</div>
          <p className="opacity-80 mt-1">
            Create at least one tax regime before adding customers.
          </p>
          <div className="mt-3">
            <Link className="underline underline-offset-4" href="/tax-regimes">
              Go to Tax regimes
            </Link>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={taxRegimes.length === 0}
          onClick={openCreate}
          className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Add customer
        </button>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/45 dark:bg-black/55 backdrop-blur-[2px]"
            aria-hidden
            onClick={closeModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-modal-title"
            className="relative z-10 w-full max-w-3xl rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950 shadow-xl shadow-black/10 dark:shadow-black/40 p-5 sm:p-6 space-y-4 max-h-[min(90vh,42rem)] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="customer-modal-title" className="text-lg font-semibold">
                {editingId ? "Edit customer" : "Add customer"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-sm opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form
              action={async (formData) => {
                await saveCustomerAction(formData);
                closeModal();
              }}
              className="space-y-4"
            >
              {editingId ? <input type="hidden" name="id" value={editingId} /> : null}

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                    required
                    autoFocus
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="phone">
                    Phone (optional)
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="email">
                    Email (optional)
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, email: e.target.value }))
                    }
                    className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  />
                </div>

                <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
                  <label className="text-sm font-medium" htmlFor="address">
                    Address (optional)
                  </label>
                  <input
                    id="address"
                    name="address"
                    value={form.address}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, address: e.target.value }))
                    }
                    className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="customerType">
                    Customer type
                  </label>
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
                    className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  >
                    <option value="INDUSTRY">Industry</option>
                    <option value="WHOLE_SALE">Whole sale</option>
                    <option value="RETAIL">Retail</option>
                    <option value="WORKER">Worker</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="residency">
                    Customer location
                  </label>
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
                    className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  >
                    <option value="LOCAL">Local</option>
                    <option value="OVERSEAS">Overseas</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-medium" htmlFor="taxRegime">
                    Tax regime
                  </label>
                  <select
                    id="taxRegime"
                    name={editingId ? "taxRegimeId" : "taxRegime"}
                    value={taxRegimeIdForSelect}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, taxRegimeId: e.target.value }))
                    }
                    className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                    disabled={taxRegimes.length === 0}
                  >
                    {taxRegimes.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.name} ({tr.vatApplies ? "VAT applies" : "VAT exempt"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <label className="inline-flex items-center gap-2 text-sm font-medium">
                    Has TPN (Taxpayer Number)?
                  </label>
                  <input
                    type="checkbox"
                    name="hasTaxpayerId"
                    checked={form.hasTaxpayerId}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setForm((p) => ({
                        ...p,
                        hasTaxpayerId: checked,
                        taxpayerId: checked ? p.taxpayerId : "",
                      }));
                    }}
                    className="h-4 w-4 accent-black dark:accent-white"
                  />
                  {!form.hasTaxpayerId ? (
                    <input type="hidden" name="taxpayerId" value="" />
                  ) : null}
                </div>

                {form.hasTaxpayerId ? (
                  <div className="grid gap-2">
                    <label className="text-sm font-medium" htmlFor="taxpayerId">
                      Taxpayer Card Number (optional)
                    </label>
                    <input
                      id="taxpayerId"
                      name="taxpayerId"
                      value={form.taxpayerId}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, taxpayerId: e.target.value }))
                      }
                      className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  disabled={taxRegimes.length === 0}
                  className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {editingId ? "Save changes" : "Add customer"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">All customers</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Regime</div>
            <div className="col-span-1">Tax ID</div>
            <div className="col-span-2">Actions</div>
          </div>

          {customers.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No customers yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {customers.map((c) => (
                <li
                  key={c.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="col-span-3 font-medium truncate">
                    {c.name}
                  </div>
                  <div className="col-span-2 opacity-80 truncate">
                    {c.phone ?? "-"}
                  </div>
                  <div className="col-span-2 opacity-80 truncate">
                    {c.customerType}
                  </div>
                  <div className="col-span-2 opacity-80 truncate">
                    {c.taxRegime.name}
                  </div>
                  <div className="col-span-1 opacity-80 truncate">
                    {c.taxpayerId ?? "-"}
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
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
                        setPendingDelete({ id: c.id, name: c.name })
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
          Showing {customers.length} customer(s). Dates are stored but not
          displayed in the table.
        </div>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this customer?"
          description={`“${pendingDelete.name}” will be removed permanently. You cannot undo this action.`}
          confirmLabel="Delete customer"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("id", pendingDelete.id);
            await deleteCustomerAction(fd);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}
