"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type SalesPointRow = {
  id: number;
  name: string;
};

const inputClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm";
const labelClass = "text-xs font-medium";
const fieldRowClass = "flex items-start gap-2";
const fieldLabelClass = [
  labelClass,
  "shrink-0 w-[7.25rem] h-8",
  "flex items-center justify-end px-2",
  "rounded-md border border-border",
  "bg-sidebar text-sidebar-foreground",
].join(" ");
const fieldControlClass = "min-w-0 flex-1";

export function SalesPointsClient(props: {
  points: SalesPointRow[];
  saveSalesPointAction: (formData: FormData) => void | Promise<void>;
  deleteSalesPointAction: (formData: FormData) => void | Promise<void>;
}) {
  const { points, saveSalesPointAction, deleteSalesPointAction } = props;
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: number;
    name: string;
  } | null>(null);
  const [name, setName] = React.useState("");
  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);

  function resetForm(opts?: { clearBanner?: boolean }) {
    setEditingId(null);
    setName("");
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

  function startEdit(p: SalesPointRow) {
    setEditingId(p.id);
    setName(p.name);
    setBanner(null);
    setIsFormOpen(true);
  }

  async function onSaveForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);
    const wasEdit = editingId != null;
    try {
      const fd = new FormData(e.currentTarget);
      if (editingId != null) fd.set("id", String(editingId));
      await saveSalesPointAction(fd);
      closeForm({ clearBanner: false });
      setBanner({
        type: "ok",
        text: wasEdit ? "Sales point updated." : "Sales point created.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save sales point.",
      });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("id", String(pendingDelete.id));
      await deleteSalesPointAction(fd);
      setPendingDelete(null);
      if (editingId === pendingDelete.id) closeForm({ clearBanner: false });
      setBanner({ type: "ok", text: "Sales point deleted." });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not delete sales point.",
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sales points</h1>
        <p className="text-sm opacity-75">
          Register outlets or counters (e.g. main depot, branch POS).
        </p>
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

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={editingId != null ? "Edit sales point" : "Add sales point"}
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
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-5 sm:p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-4">
              {editingId != null ? "Edit sales point" : "Add sales point"}
            </h2>
            <form onSubmit={onSaveForm} className="space-y-3">
              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="sales-point-name">
                  Name
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="sales-point-name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
                >
                  {editingId != null ? "Save changes" : "Add sales point"}
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
          <h2 className="text-lg font-semibold">All sales points</h2>
          <button
            type="button"
            onClick={openAddForm}
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
          >
            Add sales point
          </button>
        </div>

        {points.length === 0 ? (
          <p className="text-sm opacity-75">No sales points yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium w-36 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr
                    key={p.id}
                    className={[
                      "border-b border-border align-top",
                      editingId === p.id ? "bg-accent/15" : "",
                    ].join(" ")}
                  >
                    <td className="p-2 font-medium">{p.name}</td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs opacity-70">
          Showing {points.length} sales point{points.length === 1 ? "" : "s"}.
        </p>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this sales point?"
          description={`“${pendingDelete.name}” will be removed permanently. You cannot undo this action.`}
          confirmLabel="Delete sales point"
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
