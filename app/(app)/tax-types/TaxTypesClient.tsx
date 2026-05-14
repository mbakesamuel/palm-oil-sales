"use client";

import * as React from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { VAT_TAX_CODE } from "@/lib/tax/constants";

type RateRow = { id: string; rate: string; effectiveFromIso: string; variant: string };

type TypeRow = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  rateSchedules: RateRow[];
};

export function TaxTypesClient(props: {
  types: TypeRow[];
  saveTaxTypeAction: (formData: FormData) => void | Promise<void>;
  deleteTaxTypeAction: (formData: FormData) => void | Promise<void>;
  saveTaxRateScheduleAction: (formData: FormData) => void | Promise<void>;
  deleteTaxRateScheduleAction: (formData: FormData) => void | Promise<void>;
}) {
  const {
    types,
    saveTaxTypeAction,
    deleteTaxTypeAction,
    saveTaxRateScheduleAction,
    deleteTaxRateScheduleAction,
  } = props;

  const [typeModalOpen, setTypeModalOpen] = React.useState(false);
  const [editingTypeId, setEditingTypeId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("0");

  const [pendingDeleteType, setPendingDeleteType] = React.useState<{
    id: string;
    code: string;
  } | null>(null);
  const [pendingDeleteRate, setPendingDeleteRate] = React.useState<{
    id: string;
  } | null>(null);

  const [rateEditId, setRateEditId] = React.useState<string | null>(null);
  const [rateTaxTypeId, setRateTaxTypeId] = React.useState<string | null>(null);
  const [rateValue, setRateValue] = React.useState("");
  const [rateEffective, setRateEffective] = React.useState("");
  const [rateVariant, setRateVariant] = React.useState("DEFAULT");

  const closeTypeModal = React.useCallback(() => {
    setTypeModalOpen(false);
    setEditingTypeId(null);
    setCode("");
    setName("");
    setSortOrder("0");
  }, []);

  function openAddTypeModal() {
    setEditingTypeId(null);
    setCode("");
    setName("");
    setSortOrder("0");
    setTypeModalOpen(true);
  }

  function startEditType(t: TypeRow) {
    setEditingTypeId(t.id);
    setCode(t.code);
    setName(t.name);
    setSortOrder(String(t.sortOrder));
    setTypeModalOpen(true);
  }

  React.useEffect(() => {
    if (!typeModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeTypeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [typeModalOpen, closeTypeModal]);

  function openNewRate(taxTypeId: string) {
    setRateEditId(null);
    setRateTaxTypeId(taxTypeId);
    setRateValue("");
    setRateEffective(new Date().toISOString().slice(0, 10));
    setRateVariant("DEFAULT");
  }

  function startEditRate(taxTypeId: string, r: RateRow) {
    setRateEditId(r.id);
    setRateTaxTypeId(taxTypeId);
    setRateValue(r.rate);
    setRateEffective(r.effectiveFromIso);
    setRateVariant(r.variant || "DEFAULT");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tax types and rates</h1>
        <p className="text-sm opacity-75">
          Define each tax (e.g. VAT) and schedule rates with effective dates. Link taxes to regimes
          under{" "}
          <Link href="/tax-regimes" className="underline underline-offset-4">
            Tax regimes
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openAddTypeModal}
          className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
        >
          Add tax type
        </button>
      </div>

      {typeModalOpen ? (
        <div className="fixed inset-0 z-100 flex items-end justify-center sm:items-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/45 dark:bg-black/55 backdrop-blur-[2px]"
            aria-hidden
            onClick={closeTypeModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tax-type-modal-title"
            className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-background shadow-xl shadow-black/10 dark:shadow-black/40 p-5 sm:p-6 space-y-4 max-h-[min(90vh,32rem)] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 id="tax-type-modal-title" className="text-lg font-semibold">
                {editingTypeId ? "Edit tax type" : "Add tax type"}
              </h2>
              <button
                type="button"
                onClick={closeTypeModal}
                className="rounded-md p-1 text-sm opacity-70 hover:opacity-100 hover:bg-accent/25"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form
              action={async (formData) => {
                await saveTaxTypeAction(formData);
                closeTypeModal();
              }}
              className="space-y-4"
            >
              {editingTypeId ? <input type="hidden" name="id" value={editingTypeId} /> : null}
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="tax-type-modal-code">
                  Code
                </label>
                <input
                  id="tax-type-modal-code"
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2"
                  placeholder="e.g. VAT"
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="tax-type-modal-name">
                  Display name
                </label>
                <input
                  id="tax-type-modal-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2"
                  required
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="tax-type-modal-sort">
                  Sort order
                </label>
                <input
                  id="tax-type-modal-sort"
                  name="sortOrder"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="rounded-md border border-border bg-transparent px-3 py-2 w-32"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium">
                  {editingTypeId ? "Save type" : "Add type"}
                </button>
                <button
                  type="button"
                  onClick={closeTypeModal}
                  className="rounded-md border border-border px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {rateTaxTypeId ? (
        <form
          action={async (formData) => {
            await saveTaxRateScheduleAction(formData);
            setRateTaxTypeId(null);
            setRateEditId(null);
          }}
          className="space-y-3 max-w-xl rounded-lg border border-border p-4"
        >
          <h2 className="text-lg font-semibold">
            {rateEditId ? "Edit rate row" : "Add rate row"}
          </h2>
          <input type="hidden" name="taxTypeId" value={rateTaxTypeId} />
          {rateEditId ? <input type="hidden" name="id" value={rateEditId} /> : null}
          <div className="grid gap-2">
            <label className="text-sm font-medium">Variant</label>
            <select
              name="variant"
              value={rateVariant}
              onChange={(e) => setRateVariant(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            >
              <option value="DEFAULT">Default</option>
              <option value="SIMPLIFIED">Simplified</option>
              <option value="REAL">Real</option>
              <option value="NO_TAXPAYER_ID">No taxpayer id</option>
            </select>
            <p className="text-xs opacity-70">
              Use variants for Sales Tax rules. Most taxes should stay on Default.
            </p>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Effective from</label>
            <input
              type="date"
              name="effectiveFrom"
              value={rateEffective}
              onChange={(e) => setRateEffective(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2"
              required
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Rate (decimal)</label>
            <input
              name="rate"
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2"
              placeholder="0.1925"
              required
            />
          </div>
          <div className="flex gap-2">
            <button className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium">
              Save rate
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              onClick={() => {
                setRateTaxTypeId(null);
                setRateEditId(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">All tax types</h2>
        {types.length === 0 ? (
          <p className="text-sm opacity-75">No tax types yet.</p>
        ) : (
          <ul className="space-y-4">
            {types.map((t) => (
              <li
                key={t.id}
                className="rounded-lg border border-border p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      {t.name}{" "}
                      <span className="text-xs font-normal opacity-70">({t.code})</span>
                    </div>
                    <div className="text-xs opacity-70">Sort: {t.sortOrder}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startEditType(t)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs"
                    >
                      Edit type
                    </button>
                    <button
                      type="button"
                      onClick={() => openNewRate(t.id)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs"
                    >
                      Add rate
                    </button>
                    {t.code !== VAT_TAX_CODE ? (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteType({ id: t.id, code: t.code })}
                        className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs"
                      >
                        Delete type
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-xs font-medium opacity-70 mb-1">Rate schedule</div>
                  {t.rateSchedules.length === 0 ? (
                    <div className="text-xs opacity-70">No rates — sales for this tax will error.</div>
                  ) : (
                    <ul className="divide-y divide-border border border-border rounded-md overflow-hidden">
                      {t.rateSchedules.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span className="tabular-nums opacity-90">
                            From {r.effectiveFromIso}: {(Number.parseFloat(r.rate) * 100).toFixed(2)}%
                            {r.variant && r.variant !== "DEFAULT" ? (
                              <span className="ml-2 text-[11px] opacity-70">({r.variant})</span>
                            ) : null}
                          </span>
                          <span className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs underline underline-offset-4"
                              onClick={() => startEditRate(t.id, r)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-xs underline underline-offset-4 text-red-700 dark:text-red-400"
                              onClick={() => setPendingDeleteRate({ id: r.id })}
                            >
                              Delete
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingDeleteType ? (
        <ConfirmDialog
          title="Delete tax type?"
          description={`“${pendingDeleteType.code}” and its rate rows will be removed. Regime links will be removed.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDeleteType(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("id", pendingDeleteType.id);
            await deleteTaxTypeAction(fd);
            setPendingDeleteType(null);
          }}
        />
      ) : null}

      {pendingDeleteRate ? (
        <ConfirmDialog
          title="Delete rate row?"
          description="Historical invoices keep their own snapshots; this only affects new postings."
          confirmLabel="Delete rate"
          onCancel={() => setPendingDeleteRate(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("id", pendingDeleteRate.id);
            await deleteTaxRateScheduleAction(fd);
            setPendingDeleteRate(null);
          }}
        />
      ) : null}
    </div>
  );
}
