"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { isOperationalTaxCode } from "@/lib/tax/constants";

type TypeRow = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  currentRatePercent: string | null;
};

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
const formActionsClass =
  "flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]";

export function TaxTypesClient(props: {
  types: TypeRow[];
  saveTaxTypeAction: (formData: FormData) => void | Promise<void>;
  deleteTaxTypeAction: (formData: FormData) => void | Promise<void>;
  saveTaxRateScheduleAction: (formData: FormData) => void | Promise<void>;
}) {
  const { types, saveTaxTypeAction, deleteTaxTypeAction, saveTaxRateScheduleAction } =
    props;
  const router = useRouter();

  const [isTypeFormOpen, setIsTypeFormOpen] = React.useState(false);
  const [editingTypeId, setEditingTypeId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("0");
  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);

  const [pendingDeleteType, setPendingDeleteType] = React.useState<{
    id: string;
    code: string;
  } | null>(null);

  const [rateModal, setRateModal] = React.useState<{
    taxTypeId: string;
    code: string;
  } | null>(null);
  const [rateValue, setRateValue] = React.useState("");
  const [rateEffective, setRateEffective] = React.useState("");

  function resetTypeForm(opts?: { clearBanner?: boolean }) {
    setEditingTypeId(null);
    setCode("");
    setName("");
    setSortOrder("0");
    if (opts?.clearBanner !== false) setBanner(null);
  }

  function closeTypeForm(opts?: { clearBanner?: boolean }) {
    setIsTypeFormOpen(false);
    resetTypeForm(opts);
  }

  function openAddTypeForm() {
    resetTypeForm();
    setIsTypeFormOpen(true);
  }

  function startEditType(t: TypeRow) {
    setEditingTypeId(t.id);
    setCode(t.code);
    setName(t.name);
    setSortOrder(String(t.sortOrder));
    setBanner(null);
    setIsTypeFormOpen(true);
  }

  function openSetRate(t: TypeRow) {
    setRateModal({ taxTypeId: t.id, code: t.code });
    setRateValue("");
    setRateEffective(new Date().toISOString().slice(0, 10));
  }

  function closeRateModal() {
    setRateModal(null);
    setRateValue("");
    setRateEffective("");
  }

  async function onSaveTypeForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);
    const fd = new FormData(e.currentTarget);
    if (editingTypeId) fd.set("id", editingTypeId);
    const wasEdit = editingTypeId != null;
    try {
      await saveTaxTypeAction(fd);
      closeTypeForm({ clearBanner: false });
      setBanner({
        type: "ok",
        text: wasEdit ? "Tax type updated." : "Tax type created.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save tax type.",
      });
    }
  }

  async function onSaveRateForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rateModal) return;
    setBanner(null);
    const fd = new FormData(e.currentTarget);
    fd.set("taxTypeId", rateModal.taxTypeId);
    fd.set("variant", "DEFAULT");
    try {
      await saveTaxRateScheduleAction(fd);
      closeRateModal();
      setBanner({ type: "ok", text: "Rate saved." });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save rate.",
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tax types</h1>
        <p className="text-sm opacity-75">
          Catalog of tax levies linked to regimes. Change VAT and sales tax
          percentages on{" "}
          <Link href="/setup/tax-rates" className="underline underline-offset-4">
            Tax rates
          </Link>
          ; assign which taxes apply per regime on{" "}
          <Link href="/tax-regimes" className="underline underline-offset-4">
            Tax regimes
          </Link>
          . Add custom tax types here only when you need levies beyond VAT and
          sales tax.
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

      {isTypeFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={editingTypeId ? "Edit tax type" : "Add tax type"}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeTypeForm();
          }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => closeTypeForm()}
          />

          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background text-foreground p-3 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold">
                {editingTypeId ? "Edit tax type" : "Add tax type"}
              </div>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 text-xs"
                onClick={() => closeTypeForm()}
              >
                X
              </button>
            </div>

            <form
              onSubmit={(e) => void onSaveTypeForm(e)}
              className="mt-3 space-y-1.5 max-h-[min(28rem,calc(100vh-6rem))] overflow-y-auto pr-1"
            >
              {editingTypeId ? (
                <input type="hidden" name="id" value={editingTypeId} />
              ) : null}

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="tax-type-code">
                  Code
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="tax-type-code"
                    name="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={`${inputClass} font-mono`}
                    placeholder="e.g. ENV_LEVY"
                    required
                    autoFocus
                  />
                  <p className={hintClass}>Stable key used in snapshots and reports.</p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="tax-type-name">
                  Name
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="tax-type-name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="tax-type-sort">
                  Order
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="tax-type-sort"
                    name="sortOrder"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className={`${inputClass} max-w-24`}
                  />
                </div>
              </div>

              <div className={formActionsClass}>
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
                >
                  {editingTypeId ? "Save changes" : "Add type"}
                </button>
                <button
                  type="button"
                  onClick={() => closeTypeForm()}
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {rateModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`Set rate for ${rateModal.code}`}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeRateModal();
          }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={closeRateModal}
          />

          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background text-foreground p-3 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold">Set rate — {rateModal.code}</div>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 text-xs"
                onClick={closeRateModal}
              >
                X
              </button>
            </div>

            <form
              onSubmit={(e) => void onSaveRateForm(e)}
              className="mt-3 space-y-1.5"
            >
              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="custom-rate-effective">
                  Effective
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="custom-rate-effective"
                    type="date"
                    name="effectiveFrom"
                    value={rateEffective}
                    onChange={(e) => setRateEffective(e.target.value)}
                    className={`${inputClass} max-w-44`}
                    required
                  />
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="custom-rate-value">
                  Rate
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="custom-rate-value"
                    name="rate"
                    value={rateValue}
                    onChange={(e) => setRateValue(e.target.value)}
                    className={`${inputClass} max-w-28 font-mono`}
                    placeholder="0.05"
                    required
                  />
                  <p className={hintClass}>Decimal fraction (e.g. 0.05 = 5%).</p>
                </div>
              </div>

              <div className={formActionsClass}>
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
                >
                  Save rate
                </button>
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                  onClick={closeRateModal}
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
          <h2 className="text-lg font-semibold">All tax types</h2>
          <button
            type="button"
            onClick={openAddTypeForm}
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
          >
            Add tax type
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2 font-medium">Code</th>
                <th className="p-2 font-medium">Name</th>
                <th className="p-2 font-medium">Order</th>
                <th className="p-2 font-medium">Current rate</th>
                <th className="p-2 font-medium w-44 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {types.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-sm text-foreground/70">
                    No tax types yet. Use{" "}
                    <span className="font-medium text-foreground">Add tax type</span> to
                    create one.
                  </td>
                </tr>
              ) : (
                types.map((t) => {
                  const operational = isOperationalTaxCode(t.code);
                  return (
                    <tr
                      key={t.id}
                      className={[
                        "border-b border-border align-top",
                        editingTypeId === t.id ? "bg-accent/15" : "",
                      ].join(" ")}
                    >
                      <td className="p-2 font-mono text-xs">{t.code}</td>
                      <td className="p-2">
                        <div className="font-medium">{t.name}</div>
                        {operational ? (
                          <span className="text-[11px] opacity-60">Built-in</span>
                        ) : null}
                      </td>
                      <td className="p-2 tabular-nums opacity-80">{t.sortOrder}</td>
                      <td className="p-2">
                        {operational ? (
                          <Link
                            href="/setup/tax-rates"
                            className="text-xs underline underline-offset-4 opacity-80"
                          >
                            Tax rates
                          </Link>
                        ) : t.currentRatePercent != null ? (
                          <span className="tabular-nums">{t.currentRatePercent}%</span>
                        ) : (
                          <span className="text-xs opacity-60">—</span>
                        )}
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => startEditType(t)}
                            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                          >
                            Edit
                          </button>
                          {!operational ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openSetRate(t)}
                                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                              >
                                Set rate
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDeleteType({ id: t.id, code: t.code })
                                }
                                className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs hover:bg-red-600/10"
                              >
                                Delete
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {pendingDeleteType ? (
        <ConfirmDialog
          title="Delete tax type?"
          description={`“${pendingDeleteType.code}” and its rate rows will be removed. Regime links will be removed.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDeleteType(null)}
          onConfirm={async () => {
            try {
              const fd = new FormData();
              fd.set("id", pendingDeleteType.id);
              await deleteTaxTypeAction(fd);
              setPendingDeleteType(null);
              setBanner({ type: "ok", text: "Tax type deleted." });
              router.refresh();
            } catch (err) {
              setBanner({
                type: "error",
                text: err instanceof Error ? err.message : "Could not delete.",
              });
              setPendingDeleteType(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
