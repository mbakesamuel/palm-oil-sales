"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SALES_TAX_CODE, VAT_TAX_CODE } from "@/lib/tax/constants";
import { REGIME_TYPE_LABELS, regimeTypeHint } from "@/lib/tax/regime-type-labels";

type TaxTypeOpt = { id: string; code: string; name: string };

type RegimeRow = {
  id: string;
  name: string;
  kind: "SIMPLIFIED" | "REAL";
  vatApplies: boolean;
  commercialServiceId: string | null;
  commercialServiceName: string | null;
  taxTypeIds: string[];
  taxCodes: string[];
  customersCount: number;
  salesCount: number;
};

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

export function TaxRegimesClient(props: {
  commercialServices: Array<{ id: string; name: string }>;
  taxTypes: TaxTypeOpt[];
  regimes: RegimeRow[];
  saveTaxRegimeAction: (formData: FormData) => void | Promise<void>;
  deleteTaxRegimeAction: (formData: FormData) => void | Promise<void>;
}) {
  const { commercialServices, taxTypes, regimes, saveTaxRegimeAction, deleteTaxRegimeAction } =
    props;
  const router = useRouter();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [name, setName] = React.useState("");
  const [commercialServiceId, setCommercialServiceId] = React.useState("");
  const [kind, setKind] = React.useState<"SIMPLIFIED" | "REAL">("SIMPLIFIED");
  const [vatApplies, setVatApplies] = React.useState(true);
  const [selectedTaxTypeIds, setSelectedTaxTypeIds] = React.useState<string[]>([]);
  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);

  const vatTypeId = React.useMemo(
    () => taxTypes.find((t) => t.code === VAT_TAX_CODE)?.id,
    [taxTypes],
  );
  const satTypeId = React.useMemo(
    () => taxTypes.find((t) => t.code === SALES_TAX_CODE)?.id,
    [taxTypes],
  );

  function resetForm(opts?: { clearBanner?: boolean }) {
    setEditingId(null);
    setName("");
    setCommercialServiceId("");
    setKind("SIMPLIFIED");
    setVatApplies(true);
    setSelectedTaxTypeIds([]);
    if (opts?.clearBanner !== false) setBanner(null);
  }

  function closeForm(opts?: { clearBanner?: boolean }) {
    setIsFormOpen(false);
    resetForm(opts);
  }

  function openAddForm() {
    resetForm();
    const defaults: string[] = [];
    if (satTypeId) defaults.push(satTypeId);
    if (vatTypeId) defaults.push(vatTypeId);
    setSelectedTaxTypeIds(defaults);
    setIsFormOpen(true);
  }

  function startEdit(r: RegimeRow) {
    setEditingId(r.id);
    setName(r.name);
    setCommercialServiceId(r.commercialServiceId ?? "");
    setKind(r.kind);
    setVatApplies(r.vatApplies);
    setSelectedTaxTypeIds([...r.taxTypeIds]);
    setBanner(null);
    setIsFormOpen(true);
  }

  function selectRegimeType(next: "SIMPLIFIED" | "REAL") {
    setKind(next);
    setName((prev) => {
      const trimmed = prev.trim();
      if (!trimmed || trimmed === "Simplified" || trimmed === "Real") {
        return REGIME_TYPE_LABELS[next];
      }
      return prev;
    });
  }

  function setVatAppliesAndSync(checked: boolean) {
    setVatApplies(checked);
    if (!vatTypeId) return;
    setSelectedTaxTypeIds((prev) => {
      if (checked) return prev.includes(vatTypeId) ? prev : [...prev, vatTypeId];
      return prev.filter((id) => id !== vatTypeId);
    });
  }

  function toggleTaxType(tid: string, code: string, checked: boolean) {
    if (code === VAT_TAX_CODE) {
      setVatApplies(checked);
    }
    setSelectedTaxTypeIds((prev) => {
      if (checked) return prev.includes(tid) ? prev : [...prev, tid];
      return prev.filter((id) => id !== tid);
    });
  }

  async function onSaveForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);
    const wasEdit = editingId != null;
    try {
      const fd = new FormData(e.currentTarget);
      if (editingId) fd.set("id", editingId);
      await saveTaxRegimeAction(fd);
      closeForm({ clearBanner: false });
      setBanner({
        type: "ok",
        text: wasEdit ? "Tax regime updated." : "Tax regime created.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not save tax regime.",
      });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBanner(null);
    try {
      const fd = new FormData();
      fd.set("id", pendingDelete.id);
      await deleteTaxRegimeAction(fd);
      setPendingDelete(null);
      if (editingId === pendingDelete.id) closeForm({ clearBanner: false });
      setBanner({ type: "ok", text: "Tax regime deleted." });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Could not delete tax regime.",
      });
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tax regimes</h1>
        <p className="text-sm opacity-75">
          Each regime is either <span className="font-medium">Simplified</span> or{" "}
          <span className="font-medium">Real</span> — that tier is chosen once at
          creation and picks which sales tax rate applies. Percentages are on{" "}
          <Link href="/setup/tax-rates" className="underline underline-offset-4">
            Tax rates
          </Link>
          . Use the name to distinguish regimes on the same tier (e.g. per line).
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
          aria-label={editingId ? "Edit tax regime" : "Add tax regime"}
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
                {editingId ? "Edit tax regime" : "Add tax regime"}
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
              {selectedTaxTypeIds.map((tid) => (
                <input key={tid} type="hidden" name="taxTypeId" value={tid} />
              ))}

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="commercialServiceId">
                  Line
                </label>
                <div className={fieldControlClass}>
                  <select
                    id="commercialServiceId"
                    name="commercialServiceId"
                    className={selectClass}
                    value={commercialServiceId}
                    onChange={(e) => setCommercialServiceId(e.target.value)}
                  >
                    <option value="">All lines (shared)</option>
                    {commercialServices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <p className={hintClass}>
                    Leave as shared unless this regime applies to one commercial line only.
                  </p>
                </div>
              </div>

              {editingId ? (
                <div className={fieldRowClass}>
                  <span className={fieldLabelClass}>Type</span>
                  <div className={fieldControlClass}>
                    <span className="inline-flex h-8 items-center rounded-full border border-border bg-accent/15 px-3 text-xs font-medium">
                      {REGIME_TYPE_LABELS[kind]}
                    </span>
                    <p className={hintClass}>
                      Locked after creation. {regimeTypeHint(kind)} Customers without a
                      regime use the no-taxpayer-card rate on{" "}
                      <Link href="/setup/tax-rates" className="underline underline-offset-4">
                        Tax rates
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              ) : (
                <div className={fieldRowClass}>
                  <span className={fieldLabelClass}>Type</span>
                  <div className={fieldControlClass}>
                    <input type="hidden" name="kind" value={kind} />
                    <div className="flex flex-wrap gap-2">
                      {(["SIMPLIFIED", "REAL"] as const).map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => selectRegimeType(tier)}
                          className={[
                            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                            kind === tier
                              ? "border-brand bg-brand/15 text-foreground"
                              : "border-border hover:bg-accent/25",
                          ].join(" ")}
                        >
                          {REGIME_TYPE_LABELS[tier]}
                        </button>
                      ))}
                    </div>
                    <p className={hintClass}>{regimeTypeHint(kind)}</p>
                  </div>
                </div>
              )}

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="name">
                  Name
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="name"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder={REGIME_TYPE_LABELS[kind]}
                    required
                  />
                  <p className={hintClass}>
                    Label for staff (e.g. line or site). Does not change the sales tax
                    tier.
                  </p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>VAT</span>
                <div className={`${fieldControlClass} flex h-8 items-center`}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="vatApplies"
                      checked={vatApplies}
                      onChange={(e) => setVatAppliesAndSync(e.target.checked)}
                    />
                    <span>VAT applies</span>
                  </label>
                </div>
              </div>

              <div className={fieldRowClass}>
                <span className={[fieldLabelClass, "h-auto min-h-8 items-start pt-1.5"].join(" ")}>
                  Taxes
                </span>
                <div className={fieldControlClass}>
                  {taxTypes.length === 0 ? (
                    <p className={`${hintClass} py-1`}>
                      No tax types yet. Add them under{" "}
                      <Link href="/tax-types" className="underline underline-offset-4">
                        Tax types
                      </Link>
                      .
                    </p>
                  ) : (
                    <ul className="space-y-1.5 rounded-md border border-border p-2">
                      {taxTypes.map((t) => (
                        <li key={t.id}>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedTaxTypeIds.includes(t.id)}
                              onChange={(e) =>
                                toggleTaxType(t.id, t.code, e.target.checked)
                              }
                            />
                            <span>
                              {t.name}{" "}
                              <span className="text-xs opacity-70">({t.code})</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
                >
                  {editingId ? "Save changes" : "Add regime"}
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
          <h2 className="text-lg font-semibold">All regimes</h2>
          <button
            type="button"
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
            onClick={openAddForm}
          >
            Add regime
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-2 font-medium">Regime</th>
                <th className="p-2 font-medium">Line</th>
                <th className="p-2 font-medium">Taxes</th>
                <th className="p-2 font-medium">VAT</th>
                <th className="p-2 font-medium">Customers</th>
                <th className="p-2 font-medium w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regimes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-sm text-foreground/70">
                    No tax regimes yet. Use{" "}
                    <span className="font-medium text-foreground">Add regime</span> to
                    create one.
                  </td>
                </tr>
              ) : (
                regimes.map((r) => (
                  <tr
                    key={r.id}
                    className={[
                      "border-b border-border align-top",
                      editingId === r.id ? "bg-accent/15" : "",
                    ].join(" ")}
                  >
                    <td className="p-2">
                      <div className="font-medium">{r.name}</div>
                      <span className="mt-1 inline-flex rounded-full border border-border bg-accent/10 px-2 py-0.5 text-[11px] opacity-80">
                        {REGIME_TYPE_LABELS[r.kind]} tier
                      </span>
                    </td>
                    <td className="p-2 text-xs opacity-80">
                      {r.commercialServiceName ?? "All lines"}
                    </td>
                    <td className="p-2 text-xs opacity-80">
                      {r.taxCodes.length > 0 ? r.taxCodes.join(", ") : "—"}
                    </td>
                    <td className="p-2 text-xs opacity-80">
                      {r.vatApplies ? "Applies" : "Exempt"}
                    </td>
                    <td className="p-2 text-xs opacity-80">{r.customersCount}</td>
                    <td className="p-2 text-right">
                      <div className="flex justify-end gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => startEdit(r)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {regimes.length > 0 ? (
          <p className="text-xs opacity-70">
            Deleting a regime that is used by customers or sales may fail.
          </p>
        ) : null}
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this tax regime?"
          description={`“${pendingDelete.name}” will be removed permanently. If it is still linked to customers or sales, the delete may fail.`}
          confirmLabel="Delete regime"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
