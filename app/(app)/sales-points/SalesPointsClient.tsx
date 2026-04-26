"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type SalesPointRow = {
  id: number;
  name: string;
};

export function SalesPointsClient(props: {
  points: SalesPointRow[];
  saveSalesPointAction: (formData: FormData) => void;
  deleteSalesPointAction: (formData: FormData) => void;
}) {
  const { points, saveSalesPointAction, deleteSalesPointAction } = props;

  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: number;
    name: string;
  } | null>(null);
  const [name, setName] = React.useState("");

  function reset() {
    setEditingId(null);
    setName("");
  }

  function startEdit(p: SalesPointRow) {
    setEditingId(p.id);
    setName(p.name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sales points</h1>
        <p className="text-sm opacity-75">
          Register outlets or counters (e.g. main depot, branch POS).
        </p>
      </div>

      <form action={saveSalesPointAction} className="space-y-4 max-w-xl">
        {editingId != null ? (
          <input type="hidden" name="id" value={String(editingId)} />
        ) : null}

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="name">
            Name
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

        <div className="flex items-center gap-2">
          <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
            {editingId != null ? "Edit sales point" : "Add sales point"}
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
        <h2 className="text-lg font-semibold">All sales points</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-8">Name</div>
            <div className="col-span-4">Actions</div>
          </div>

          {points.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No sales points yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {points.map((p) => (
                <li
                  key={p.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="col-span-8 font-medium truncate">{p.name}</div>
                  <div className="col-span-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ id: p.id, name: p.name })}
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
        <div className="text-xs opacity-70">Showing {points.length} sales point(s).</div>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this sales point?"
          description={`“${pendingDelete.name}” will be removed permanently. You cannot undo this action.`}
          confirmLabel="Delete sales point"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("id", String(pendingDelete.id));
            await deleteSalesPointAction(fd);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}
