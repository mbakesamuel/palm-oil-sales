"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type SalesPointRow = { id: number; name: string };

type LocationRow = {
  id: number;
  name: string;
  salesPointId: number;
  salesPointName: string;
};

export function StorageLocationsClient(props: {
  salesPoints: SalesPointRow[];
  locations: LocationRow[];
  /** Clerk / supervisor: only their assigned collection point */
  salesPointLocked?: boolean;
  lockedSalesPointName?: string | null;
  saveStorageLocationAction: (formData: FormData) => void | Promise<void>;
  deleteStorageLocationAction: (formData: FormData) => void | Promise<void>;
}) {
  const {
    salesPoints,
    locations,
    salesPointLocked = false,
    lockedSalesPointName,
    saveStorageLocationAction,
    deleteStorageLocationAction,
  } = props;

  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<LocationRow | null>(null);
  const [name, setName] = React.useState("");
  const [salesPointId, setSalesPointId] = React.useState(
    () => String(salesPoints[0]?.id ?? ""),
  );
  const [error, setError] = React.useState<string | null>(null);

  function reset() {
    setEditingId(null);
    setName("");
    setSalesPointId(String(salesPoints[0]?.id ?? ""));
    setError(null);
  }

  function startEdit(row: LocationRow) {
    setEditingId(row.id);
    setName(row.name);
    setSalesPointId(String(row.salesPointId));
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Storage locations</h1>
        <p className="text-sm opacity-75">
          Tanks, silos, or bays where stock is held at each collection point (used when receiving
          stock).
        </p>
        {salesPointLocked ? (
          <p className="text-xs opacity-70">
            You can only manage locations at your assigned collection point
            {lockedSalesPointName ? `: ${lockedSalesPointName}` : ""}.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-600/40 bg-red-600/5 px-4 py-3 text-sm text-red-950 dark:text-red-200 max-w-xl">
          {error}
        </div>
      ) : null}

      <form
        action={async (formData) => {
          setError(null);
          try {
            await saveStorageLocationAction(formData);
            const isCreate = !String(formData.get("id") ?? "").trim();
            if (isCreate) reset();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Save failed.");
          }
        }}
        className="space-y-4 max-w-xl"
      >
        {editingId != null ? <input type="hidden" name="id" value={String(editingId)} /> : null}

        <div className="grid gap-2">
          <span className="text-sm font-medium">Sales point</span>
          {salesPointLocked && salesPoints[0] ? (
            <>
              <input type="hidden" name="salesPointId" value={String(salesPoints[0].id)} />
              <div className="h-10 flex items-center rounded-md border border-border px-3 text-sm bg-foreground/[0.03]">
                {lockedSalesPointName ?? salesPoints[0].name}
              </div>
            </>
          ) : (
            <select
              id="sl-salesPointId"
              name="salesPointId"
              value={salesPointId}
              onChange={(e) => setSalesPointId(e.target.value)}
              className="h-10 rounded-md border border-border bg-transparent px-3 text-sm"
              required
            >
              {salesPoints.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="sl-name">
            Location name
          </label>
          <input
            id="sl-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
            placeholder="e.g. Production tank 3"
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
          >
            {editingId != null ? "Save changes" : "Add location"}
          </button>
          {editingId != null ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent/25"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          {salesPointLocked ? "Locations at your collection point" : "All locations"}
        </h2>
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-12 gap-2 border-b border-border px-3 py-2 text-xs font-medium opacity-70">
            {salesPointLocked ? null : <div className="col-span-3">Sales point</div>}
            <div className={salesPointLocked ? "col-span-6" : "col-span-5"}>Location</div>
            <div className={salesPointLocked ? "col-span-6 text-right" : "col-span-4 text-right"}>
              Actions
            </div>
          </div>

          {locations.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No locations yet. Add one above.</div>
          ) : (
            <ul className="divide-y divide-border">
              {locations.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-sm"
                >
                  {salesPointLocked ? null : (
                    <div className="col-span-3 truncate text-xs opacity-80">
                      {row.salesPointName}
                    </div>
                  )}
                  <div
                    className={
                      salesPointLocked ? "col-span-6 font-medium truncate" : "col-span-5 font-medium truncate"
                    }
                  >
                    {row.name}
                  </div>
                  <div
                    className={
                      salesPointLocked
                        ? "col-span-6 flex justify-end gap-2"
                        : "col-span-4 flex justify-end gap-2"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(row)}
                      className="rounded-md border border-red-600/40 px-3 py-1.5 text-xs text-red-700 hover:bg-red-600/10 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this storage location?"
          description={`“${pendingDelete.name}” at ${pendingDelete.salesPointName} will be removed. This is only allowed if no stock batches reference it.`}
          confirmLabel="Delete location"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            setError(null);
            try {
              const fd = new FormData();
              fd.set("id", String(pendingDelete.id));
              await deleteStorageLocationAction(fd);
              setPendingDelete(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Delete failed.");
              setPendingDelete(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
