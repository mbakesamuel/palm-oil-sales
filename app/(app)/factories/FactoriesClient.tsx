"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type FactoryRow = {
  id: string;
  name: string;
  isActive: boolean;
  commercialServiceId: string;
  commercialService: { name: string };
};

type CommercialOption = { id: string; name: string };

export function FactoriesClient(props: {
  factories: FactoryRow[];
  commercialServices: CommercialOption[];
  defaultCommercialServiceId: string | null;
  saveFactoryAction: (formData: FormData) => void | Promise<void>;
  deleteFactoryAction: (formData: FormData) => void | Promise<void>;
}) {
  const {
    factories,
    commercialServices,
    defaultCommercialServiceId,
    saveFactoryAction,
    deleteFactoryAction,
  } = props;

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [name, setName] = React.useState("");
  const [commercialServiceId, setCommercialServiceId] = React.useState(
    defaultCommercialServiceId ?? commercialServices[0]?.id ?? "",
  );
  const [isActive, setIsActive] = React.useState(true);

  function reset() {
    setEditingId(null);
    setName("");
    setIsActive(true);
    setCommercialServiceId(defaultCommercialServiceId ?? commercialServices[0]?.id ?? "");
  }

  function startEdit(f: FactoryRow) {
    setEditingId(f.id);
    setName(f.name);
    setCommercialServiceId(f.commercialServiceId);
    setIsActive(f.isActive);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <section className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Factories</h1>
          <p className="text-sm opacity-75">
            Posting sites for rubber and other factory-based commercial lines.
          </p>
        </header>

        <form
          action={async (formData) => {
            await saveFactoryAction(formData);
            if (!String(formData.get("id") ?? "").trim()) reset();
          }}
          className="space-y-4 max-w-xl"
        >
          {editingId ? <input type="hidden" name="id" value={editingId} /> : null}
          <input type="hidden" name="commercialServiceId" value={commercialServiceId} />

          {commercialServices.length > 1 ? (
            <label className="grid gap-2">
              <span className="text-sm font-medium">Commercial line</span>
              <select
                className="rounded-md border border-border bg-transparent px-3 py-2"
                value={commercialServiceId}
                onChange={(e) => setCommercialServiceId(e.target.value)}
              >
                {commercialServices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="grid gap-2" htmlFor="factory-name">
            <span className="text-sm font-medium">Name</span>
            <input
              id="factory-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2"
              required
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isActive"
              value="1"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>

          <button
            type="submit"
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
          >
            {editingId ? "Save factory" : "Add factory"}
          </button>
        </form>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">All factories</h2>
          <ul className="rounded-lg border border-border divide-y divide-border">
            {factories.length === 0 ? (
              <li className="p-4 text-sm opacity-75">No factories yet.</li>
            ) : (
              factories.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span>
                    {f.name}{" "}
                    <span className="opacity-60">({f.commercialService.name})</span>
                    {!f.isActive ? (
                      <span className="ml-2 text-xs opacity-60">inactive</span>
                    ) : null}
                  </span>
                  <span className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-xs"
                      onClick={() => startEdit(f)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-red-600/40 px-2 py-1 text-xs text-red-700"
                      onClick={() => setPendingDelete({ id: f.id, name: f.name })}
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete factory?"
          description={`Remove ${pendingDelete.name}?`}
          confirmLabel="Delete"
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("id", pendingDelete.id);
            await deleteFactoryAction(fd);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  );
}
