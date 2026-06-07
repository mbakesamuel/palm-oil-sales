"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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

export function PaymentMethodsClient(props: {
  methods: MethodRow[];
  savePaymentMethodAction: (formData: FormData) => void | Promise<void>;
  deletePaymentMethodAction: (formData: FormData) => void | Promise<void>;
}) {
  const { methods, savePaymentMethodAction, deletePaymentMethodAction } = props;
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
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
  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);

  function resetForm(opts?: { clearBanner?: boolean }) {
    setEditingId(null);
    setName("");
    setCode("");
    setKind("SIMPLE");
    setSortOrder("0");
    setIsActive(true);
    setIsSystem(false);
    if (opts?.clearBanner !== false) setBanner(null);
  }

  function closeForm(opts?: { clearBanner?: boolean }) {
    setIsFormOpen(false);
    resetForm(opts);
  }

  function openAddForm() {
    resetForm();
    setBanner(null);
    setIsFormOpen(true);
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
    setBanner(null);
    setIsFormOpen(true);
  }

  async function onSaveForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);
    const fd = new FormData(e.currentTarget);
    if (editingId) fd.set("id", editingId);
    const wasEdit = editingId != null;
    try {
      await savePaymentMethodAction(fd);
      closeForm({ clearBanner: false });
      setBanner({
        type: "ok",
        text: wasEdit ? "Payment method updated." : "Payment method created.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save payment method.",
      });
    }
  }

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
          aria-label={editingId ? "Edit payment method" : "Add payment method"}
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
                {editingId ? "Edit payment method" : "Add payment method"}
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

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="payment-method-name">
                  Name
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="payment-method-name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    required
                    autoFocus
                  />
                  <p className={hintClass}>Shown in POS and delivery order forms.</p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="payment-method-code">
                  Code
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="payment-method-code"
                    name="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={`${inputClass} font-mono`}
                    required
                    readOnly={isSystem}
                    disabled={isSystem}
                  />
                  {isSystem ? (
                    <p className={hintClass}>Built-in code cannot be changed.</p>
                  ) : (
                    <p className={hintClass}>
                      Uppercase letters, numbers, underscores (e.g. MOBILE_MONEY).
                    </p>
                  )}
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="payment-method-kind">
                  Kind
                </label>
                <div className={fieldControlClass}>
                  <select
                    id="payment-method-kind"
                    name="kind"
                    value={kind}
                    onChange={(e) =>
                      setKind(e.target.value as Exclude<PaymentMethodKind, "CREDIT">)
                    }
                    className={selectClass}
                    disabled={isSystem}
                  >
                    {KIND_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className={hintClass}>
                    Controls how amounts are captured at checkout.
                  </p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="payment-method-sort">
                  Order
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="payment-method-sort"
                    name="sortOrder"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className={`${inputClass} max-w-[6rem]`}
                  />
                  <p className={hintClass}>Lower numbers appear first in pick lists.</p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>Active</span>
                <div className={`${fieldControlClass} flex h-8 items-center gap-2`}>
                  <input
                    type="checkbox"
                    name="isActive"
                    value="1"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span className="text-xs opacity-80">
                    Shown in POS and delivery orders
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
                >
                  {editingId ? "Save changes" : "Add method"}
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
          <h2 className="text-lg font-semibold">All methods</h2>
          <button
            type="button"
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
            onClick={openAddForm}
          >
            Add payment method
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Code</th>
                <th className="p-2 font-medium">Kind</th>
                <th className="p-2 font-medium">Order</th>
                <th className="p-2 font-medium">Status</th>
                <th className="p-2 font-medium">Usage</th>
                <th className="p-2 font-medium w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {methods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-foreground/70">
                    No payment methods yet. Use{" "}
                    <span className="font-medium text-foreground">Add payment method</span>{" "}
                    to create one.
                  </td>
                </tr>
              ) : (
                methods.map((m) => (
                  <tr
                    key={m.id}
                    className={[
                      "border-b border-border align-top",
                      editingId === m.id ? "bg-accent/15" : "",
                    ].join(" ")}
                  >
                    <td className="p-2 font-medium">{m.name}</td>
                    <td className="p-2 font-mono text-xs opacity-80">{m.code}</td>
                    <td className="p-2 opacity-90">
                      {PAYMENT_METHOD_KIND_LABELS[
                        m.kind as Exclude<PaymentMethodKind, "CREDIT">
                      ] ?? m.kind}
                    </td>
                    <td className="p-2 tabular-nums">{m.sortOrder}</td>
                    <td className="p-2">
                      {m.isActive ? (
                        <span className="inline-flex rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-border bg-accent/10 px-2 py-0.5 text-xs opacity-80">
                          Inactive
                        </span>
                      )}
                      {m.isSystem ? (
                        <span className="ml-2 text-xs opacity-50">(built-in)</span>
                      ) : null}
                    </td>
                    <td className="p-2 tabular-nums">{m.usageCount}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                          onClick={() => startEdit(m)}
                        >
                          Edit
                        </button>
                        {!m.isSystem ? (
                          <button
                            type="button"
                            className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10"
                            disabled={m.usageCount > 0}
                            title={
                              m.usageCount > 0
                                ? "Used on transactions — deactivate instead"
                                : undefined
                            }
                            onClick={() =>
                              setPendingDelete({ id: m.id, name: m.name })
                            }
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

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
              setPendingDelete(null);
              setBanner({ type: "ok", text: "Payment method deleted." });
              router.refresh();
            } catch (e) {
              setBanner({
                type: "error",
                text: e instanceof Error ? e.message : "Could not delete payment method.",
              });
              setPendingDelete(null);
            }
          }}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}
