"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type RegimeRow = {
  id: string;
  name: string;
  vatApplies: boolean;
  customersCount: number;
  salesCount: number;
};

export function TaxRegimesClient(props: {
  regimes: RegimeRow[];
  saveTaxRegimeAction: (formData: FormData) => void;
  deleteTaxRegimeAction: (formData: FormData) => void;
}) {
  const { regimes, saveTaxRegimeAction, deleteTaxRegimeAction } = props;

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [name, setName] = React.useState("");
  const [vatApplies, setVatApplies] = React.useState(true);

  function reset() {
    setEditingId(null);
    setName("");
    setVatApplies(true);
  }

  function startEdit(r: RegimeRow) {
    setEditingId(r.id);
    setName(r.name);
    setVatApplies(r.vatApplies);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tax regimes</h1>
        <p className="text-sm opacity-75">
          Create and manage regimes. VAT charging is controlled by “VAT applies”.
        </p>
      </div>

      <form action={saveTaxRegimeAction} className="space-y-4 max-w-xl">
        {editingId ? <input type="hidden" name="id" value={editingId} /> : null}

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="name">
            Regime name
          </label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="vatApplies"
            checked={vatApplies}
            onChange={(e) => setVatApplies(e.target.checked)}
          />
          <span>VAT applies</span>
        </label>

        <div className="flex items-center gap-2">
          <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
            {editingId ? "Edit regime" : "Add regime"}
          </button>
          {editingId ? (
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
        <h2 className="text-lg font-semibold">All regimes</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-4">Name</div>
            <div className="col-span-2">VAT</div>
            <div className="col-span-2">Customers</div>
            <div className="col-span-2">Sales</div>
            <div className="col-span-2">Actions</div>
          </div>

          {regimes.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No tax regimes yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {regimes.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="col-span-4 font-medium truncate">{r.name}</div>
                  <div className="col-span-2 opacity-80">
                    {r.vatApplies ? "Applies" : "Exempt"}
                  </div>
                  <div className="col-span-2 opacity-80">{r.customersCount}</div>
                  <div className="col-span-2 opacity-80">{r.salesCount}</div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ id: r.id, name: r.name })}
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
          Deleting a regime that is used by customers or sales may fail.
        </div>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this tax regime?"
          description={`“${pendingDelete.name}” will be removed permanently. If it is still linked to customers or sales, the delete may fail.`}
          confirmLabel="Delete regime"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("id", pendingDelete.id);
            await deleteTaxRegimeAction(fd);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}

