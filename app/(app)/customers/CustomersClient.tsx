"use client";

import * as React from "react";
import type { CustomerType } from "@prisma/client";
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
  taxpayerId: string | null;
  taxRegime: { id: string; name: string; vatApplies: boolean };
  createdAtIso: string;
};

export function CustomersClient(props: {
  taxRegimes: TaxRegime[];
  customers: CustomerRow[];
  saveCustomerAction: (formData: FormData) => void;
  deleteCustomerAction: (formData: FormData) => void;
}) {
  const { taxRegimes, customers, saveCustomerAction, deleteCustomerAction } = props;

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
    taxRegimeId: taxRegimes[0]?.id ?? "",
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
      taxRegimeId: taxRegimes[0]?.id ?? "",
      taxpayerId: "",
    });
  }

  const taxRegimeIdForSelect = form.taxRegimeId || taxRegimes[0]?.id || "";

  function startEdit(row: CustomerRow) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      customerType: row.customerType,
      taxRegimeId: row.taxRegime.id,
      taxpayerId: row.taxpayerId ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
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

      <form action={saveCustomerAction} className="space-y-4">
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
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
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
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
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
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
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
                setForm((p) => ({ ...p, customerType: e.target.value as CustomerType }))
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
            <label className="text-sm font-medium" htmlFor="taxRegime">
              Tax regime
            </label>
            <select
              id="taxRegime"
              name={editingId ? "taxRegimeId" : "taxRegime"}
              value={taxRegimeIdForSelect}
              onChange={(e) => setForm((p) => ({ ...p, taxRegimeId: e.target.value }))}
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
            <label className="text-sm font-medium" htmlFor="taxpayerId">
              Taxpayer ID (optional)
            </label>
            <input
              id="taxpayerId"
              name="taxpayerId"
              value={form.taxpayerId}
              onChange={(e) => setForm((p) => ({ ...p, taxpayerId: e.target.value }))}
              className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            disabled={taxRegimes.length === 0}
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {editingId ? "Edit customer" : "Add customer"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetToCreate}
              className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

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
                <li key={c.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center">
                  <div className="col-span-3 font-medium truncate">{c.name}</div>
                  <div className="col-span-2 opacity-80 truncate">{c.phone ?? "-"}</div>
                  <div className="col-span-2 opacity-80 truncate">{c.customerType}</div>
                  <div className="col-span-2 opacity-80 truncate">{c.taxRegime.name}</div>
                  <div className="col-span-1 opacity-80 truncate">{c.taxpayerId ?? "-"}</div>
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
                      onClick={() => setPendingDelete({ id: c.id, name: c.name })}
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
          Showing {customers.length} customer(s). Dates are stored but not displayed in the table.
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

