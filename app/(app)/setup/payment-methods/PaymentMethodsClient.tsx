"use client";

import * as React from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  PAYMENT_METHOD_KIND_LABELS,
  type PaymentMethodKind,
} from "@/lib/payment-methods/types";

type MethodRow = {
  id: string;
  code: string;
  name: string;
  kind: PaymentMethodKind;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
  usageCount: number;
};

const KIND_OPTIONS = Object.entries(PAYMENT_METHOD_KIND_LABELS) as Array<
  [Exclude<PaymentMethodKind, "CREDIT">, string]
>;

export function PaymentMethodsClient(props: {
  methods: MethodRow[];
  savePaymentMethodAction: (formData: FormData) => void | Promise<void>;
  deletePaymentMethodAction: (formData: FormData) => void | Promise<void>;
}) {
  const { methods, savePaymentMethodAction, deletePaymentMethodAction } = props;

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [kind, setKind] = React.useState<Exclude<PaymentMethodKind, "CREDIT">>("SIMPLE");
  const [sortOrder, setSortOrder] = React.useState("0");
  const [isActive, setIsActive] = React.useState(true);
  const [isSystem, setIsSystem] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [banner, setBanner] = React.useState<string | null>(null);

  const closeModal = React.useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setName("");
    setCode("");
    setKind("SIMPLE");
    setSortOrder("0");
    setIsActive(true);
    setIsSystem(false);
  }, []);

  function openAdd() {
    closeModal();
    setModalOpen(true);
  }

  function startEdit(row: MethodRow) {
    setEditingId(row.id);
    setName(row.name);
    setCode(row.code);
    setKind(
      row.kind === "CREDIT"
        ? "SIMPLE"
        : (row.kind as Exclude<PaymentMethodKind, "CREDIT">),
    );
    setSortOrder(String(row.sortOrder));
    setIsActive(row.isActive);
    setIsSystem(row.isSystem);
    setModalOpen(true);
  }

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

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Payment methods</h1>
        <p className="text-sm opacity-75">
          Configure how sales and delivery orders accept payment. Inactive methods
          are hidden from POS and delivery order forms but remain on past
          transactions.
        </p>
      </header>

      {banner ? (
        <div className="rounded-lg border border-border bg-foreground/5 px-4 py-3 text-sm">
          {banner}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">All methods</h2>
        <button
          type="button"
          className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-sm font-medium"
          onClick={openAdd}
        >
          Add payment method
        </button>
      </div>

      {methods.length === 0 ? (
        <p className="text-sm opacity-75">No payment methods yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-foreground/[0.04] text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Usage</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {methods.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{m.name}</td>
                  <td className="px-3 py-2 font-mono text-xs opacity-80">{m.code}</td>
                  <td className="px-3 py-2">
                    {PAYMENT_METHOD_KIND_LABELS[
                      m.kind as Exclude<PaymentMethodKind, "CREDIT">
                    ] ?? m.kind}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{m.sortOrder}</td>
                  <td className="px-3 py-2">
                    {m.isActive ? (
                      <span>Active</span>
                    ) : (
                      <span className="opacity-60">Inactive</span>
                    )}
                    {m.isSystem ? (
                      <span className="ml-2 text-xs opacity-50">(built-in)</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{m.usageCount}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-border px-2 py-1 text-xs"
                        onClick={() => startEdit(m)}
                      >
                        Edit
                      </button>
                      {!m.isSystem ? (
                        <button
                          type="button"
                          className="rounded-md border border-red-600/40 px-2 py-1 text-xs text-red-700"
                          disabled={m.usageCount > 0}
                          title={
                            m.usageCount > 0
                              ? "Used on transactions — deactivate instead"
                              : undefined
                          }
                          onClick={() => setPendingDelete({ id: m.id, name: m.name })}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
            aria-labelledby="payment-method-modal-title"
            className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-background shadow-xl shadow-black/10 dark:shadow-black/40 p-5 sm:p-6 space-y-4 max-h-[min(90vh,32rem)] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="payment-method-modal-title" className="text-lg font-semibold">
                {editingId ? "Edit payment method" : "Add payment method"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-sm opacity-70 hover:opacity-100 hover:bg-accent/25"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form
              action={async (formData) => {
                try {
                  await savePaymentMethodAction(formData);
                  setBanner(null);
                  closeModal();
                } catch (e) {
                  setBanner(e instanceof Error ? e.message : "Save failed.");
                }
              }}
              className="space-y-4"
            >
              {editingId ? <input type="hidden" name="id" value={editingId} /> : null}

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="payment-method-modal-name">
                  Display name
                </label>
                <input
                  id="payment-method-modal-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2"
                  required
                  autoFocus
                />
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="payment-method-modal-code">
                  Code
                </label>
                <input
                  id="payment-method-modal-code"
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm"
                  required
                  readOnly={isSystem}
                  disabled={isSystem}
                />
                {isSystem ? (
                  <p className="text-xs opacity-60">
                    Built-in code cannot be changed.
                  </p>
                ) : (
                  <p className="text-xs opacity-60">
                    Uppercase letters, numbers, underscores (e.g. MOBILE_MONEY).
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="payment-method-modal-kind">
                  Kind
                </label>
                <select
                  id="payment-method-modal-kind"
                  name="kind"
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as Exclude<PaymentMethodKind, "CREDIT">)
                  }
                  className="rounded-md border border-border bg-transparent px-3 py-2"
                  disabled={isSystem}
                >
                  {KIND_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="payment-method-modal-sort">
                  Sort order
                </label>
                <input
                  id="payment-method-modal-sort"
                  name="sortOrder"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2 w-32"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  value="1"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active (shown in POS and delivery orders)
              </label>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
                >
                  {editingId ? "Save method" : "Add method"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete payment method?"
          description={`Remove ${pendingDelete.name}? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            try {
              const fd = new FormData();
              fd.set("id", pendingDelete.id);
              await deletePaymentMethodAction(fd);
              setBanner(null);
              setPendingDelete(null);
            } catch (e) {
              setBanner(e instanceof Error ? e.message : "Delete failed.");
              setPendingDelete(null);
            }
          }}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}
