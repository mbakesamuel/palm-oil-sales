"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  saveGlobalRoleDefinition,
  setGlobalRoleDefinitionActive,
  type GlobalRoleRow,
} from "./actions";

const inputClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm";
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

export function GlobalRoleDefinitions(props: {
  roles: GlobalRoleRow[];
  selectedRoleId: string;
  onSelectRole: (id: string) => void;
}) {
  const { roles, selectedRoleId, onSelectRole } = props;
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("10");
  const [banner, setBanner] = React.useState<{ type: "error" | "ok"; text: string } | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);

  const editingRow = editingId ? roles.find((r) => r.id === editingId) : null;
  const codeLocked = Boolean(editingRow?.legacyRole);

  function resetForm(opts?: { clearBanner?: boolean }) {
    setEditingId(null);
    setCode("");
    setDisplayName("");
    setSortOrder("10");
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

  function startEdit(row: GlobalRoleRow) {
    setEditingId(row.id);
    setCode(row.code);
    setDisplayName(row.displayName);
    setSortOrder(String(row.sortOrder));
    setBanner(null);
    setIsFormOpen(true);
    onSelectRole(row.id);
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);
    setBusy(true);
    const wasEdit = editingId != null;
    try {
      const fd = new FormData(e.currentTarget);
      if (editingId) fd.set("id", editingId);
      await saveGlobalRoleDefinition(fd);
      closeForm({ clearBanner: false });
      setBanner({
        type: "ok",
        text: wasEdit ? "Global role updated." : "Global role created.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save global role.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(row: GlobalRoleRow, nextActive: boolean) {
    setBanner(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("id", row.id);
      if (nextActive) fd.append("isActive", "1");
      else fd.append("isActive", "0");
      await setGlobalRoleDefinitionActive(fd);
      if (!nextActive && selectedRoleId === row.id) {
        const fallback = roles.find((r) => r.id !== row.id && r.isActive);
        onSelectRole(fallback?.id ?? "");
      }
      setBanner({
        type: "ok",
        text: nextActive ? "Global role reactivated." : "Global role deactivated.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not update global role.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
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
          aria-label={editingId ? "Edit global role" : "Add global role"}
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
                {editingId ? "Edit global role" : "Add global role"}
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
              onSubmit={(e) => void onSave(e)}
              className="mt-3 space-y-1.5 max-h-[min(28rem,calc(100vh-6rem))] overflow-y-auto pr-1"
            >
              {editingId ? <input type="hidden" name="id" value={editingId} /> : null}

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="globalRoleCode">
                  Code
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="globalRoleCode"
                    name="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={`${inputClass} font-mono text-xs`}
                    placeholder="e.g. regional_officer"
                    required
                    readOnly={codeLocked}
                    disabled={busy || codeLocked}
                  />
                  <p className={hintClass}>
                    {codeLocked
                      ? "Built-in role codes cannot be changed."
                      : "Stable key; used for default permissions."}
                  </p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="globalRoleDisplayName">
                  Display name
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="globalRoleDisplayName"
                    name="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Regional officer"
                    required
                    disabled={busy}
                  />
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="globalRoleSortOrder">
                  Sort order
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="globalRoleSortOrder"
                    name="sortOrder"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className={`${inputClass} w-24 tabular-nums`}
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  {editingId ? "Save changes" : "Add global role"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => closeForm()}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Global role definitions</h2>
            <p className="text-xs opacity-70 mt-0.5">
              Org-wide roles (Admin, Director, Manager, Officer, or custom). Select a row to
              configure route access below. Line staff roles are defined per commercial line.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={openAddForm}
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Add global role
          </button>
        </div>

        {roles.length === 0 ? (
          <p className="text-sm opacity-75">No global roles yet. Add one above.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">Display name</th>
                  <th className="p-2 font-medium">Code</th>
                  <th className="p-2 font-medium w-14">Sort</th>
                  <th className="p-2 font-medium w-16">Users</th>
                  <th className="p-2 font-medium w-20">Status</th>
                  <th className="p-2 font-medium text-right w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((row) => (
                  <tr
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectRole(row.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectRole(row.id);
                      }
                    }}
                    className={[
                      "border-b border-border align-top cursor-pointer hover:bg-accent/10",
                      selectedRoleId === row.id ? "bg-brand/10" : "",
                      !row.isActive ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <td className="p-2 font-medium">{row.displayName}</td>
                    <td className="p-2 font-mono text-xs">{row.code}</td>
                    <td className="p-2 tabular-nums">{row.sortOrder}</td>
                    <td className="p-2 tabular-nums">{row.userCount}</td>
                    <td className="p-2">
                      {row.isActive ? (
                        <span className="inline-flex rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-border bg-accent/10 px-2 py-0.5 text-xs opacity-80">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-row items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => startEdit(row)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25 disabled:opacity-50 whitespace-nowrap"
                        >
                          Edit
                        </button>
                        {row.isActive ? (
                          <button
                            type="button"
                            disabled={busy || row.code === "admin"}
                            title={
                              row.code === "admin"
                                ? "Admin role cannot be deactivated"
                                : undefined
                            }
                            onClick={() => void toggleActive(row, false)}
                            className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10 disabled:opacity-50 whitespace-nowrap"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void toggleActive(row, true)}
                            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25 disabled:opacity-50 whitespace-nowrap"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
