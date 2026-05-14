"use client";

import * as React from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { VAT_TAX_CODE } from "@/lib/tax/constants";

type TaxTypeOpt = { id: string; code: string; name: string };

type RegimeRow = {
  id: string;
  name: string;
  kind: "SIMPLIFIED" | "REAL";
  vatApplies: boolean;
  taxTypeIds: string[];
  taxCodes: string[];
  customersCount: number;
  salesCount: number;
};

export function TaxRegimesClient(props: {
  taxTypes: TaxTypeOpt[];
  regimes: RegimeRow[];
  saveTaxRegimeAction: (formData: FormData) => void | Promise<void>;
  deleteTaxRegimeAction: (formData: FormData) => void | Promise<void>;
}) {
  const { taxTypes, regimes, saveTaxRegimeAction, deleteTaxRegimeAction } = props;

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<"SIMPLIFIED" | "REAL">("SIMPLIFIED");
  const [vatApplies, setVatApplies] = React.useState(true);
  const [selectedTaxTypeIds, setSelectedTaxTypeIds] = React.useState<string[]>([]);

  const vatTypeId = React.useMemo(
    () => taxTypes.find((t) => t.code === VAT_TAX_CODE)?.id,
    [taxTypes],
  );

  function reset() {
    setEditingId(null);
    setName("");
    setKind("SIMPLIFIED");
    setVatApplies(true);
    setSelectedTaxTypeIds([]);
  }

  function startEdit(r: RegimeRow) {
    setEditingId(r.id);
    setName(r.name);
    setKind(r.kind);
    setVatApplies(r.vatApplies);
    setSelectedTaxTypeIds([...r.taxTypeIds]);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tax regimes</h1>
        <p className="text-sm opacity-75">
          Link one or more taxes to each regime. Rates and effective dates are managed under{" "}
          <Link href="/tax-types" className="underline underline-offset-4">
            Tax types
          </Link>
          . “VAT applies” keeps the VAT tax in sync with the selection.
        </p>
      </div>

      <form
        action={async (formData) => {
          await saveTaxRegimeAction(formData);
          const isCreate = !String(formData.get("id") ?? "").trim();
          if (isCreate) reset();
        }}
        className="space-y-4 max-w-xl"
      >
        {editingId ? <input type="hidden" name="id" value={editingId} /> : null}
        {selectedTaxTypeIds.map((tid) => (
          <input key={tid} type="hidden" name="taxTypeId" value={tid} />
        ))}

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="name">
            Regime name
          </label>
          <input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="kind">
            Sales tax kind
          </label>
          <select
            id="kind"
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as "SIMPLIFIED" | "REAL")}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          >
            <option value="SIMPLIFIED">Simplified</option>
            <option value="REAL">Real</option>
          </select>
          <p className="text-xs opacity-70">
            Used to determine Sales Tax rate (unless customer has no taxpayer id, which overrides to 10%).
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="vatApplies"
            checked={vatApplies}
            onChange={(e) => setVatAppliesAndSync(e.target.checked)}
          />
          <span>VAT applies</span>
        </label>

        <div className="space-y-2">
          <div className="text-sm font-medium">Taxes on this regime</div>
          {taxTypes.length === 0 ? (
            <p className="text-sm opacity-75">
              No tax types yet. Add them under{" "}
              <Link href="/tax-types" className="underline underline-offset-4">
                Tax types
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2 rounded-lg border border-border p-3">
              {taxTypes.map((t) => (
                <li key={t.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTaxTypeIds.includes(t.id)}
                      onChange={(e) => toggleTaxType(t.id, t.code, e.target.checked)}
                    />
                    <span>
                      {t.name}{" "}
                      <span className="opacity-70 text-xs">({t.code})</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium">
            {editingId ? "Edit regime" : "Add regime"}
          </button>
          {editingId ? (
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
        <h2 className="text-lg font-semibold">All regimes</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-border">
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Taxes</div>
            <div className="col-span-2">VAT</div>
            <div className="col-span-2">Customers</div>
            <div className="col-span-2">Actions</div>
          </div>

          {regimes.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No tax regimes yet.</div>
          ) : (
            <ul className="divide-y divide-border">
              {regimes.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
                >
                  <div className="col-span-3 font-medium truncate">{r.name}</div>
                  <div className="col-span-3 text-xs opacity-80 truncate">
                    {r.taxCodes.length > 0 ? r.taxCodes.join(", ") : "—"}
                  </div>
                  <div className="col-span-2 opacity-80">
                    {r.vatApplies ? "Applies" : "Exempt"}
                  </div>
                  <div className="col-span-2 opacity-80">{r.customersCount}</div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
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
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-xs opacity-70">
          Deleting a regime that is used by customers or sales may fail.
        </div>
      </section>

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this tax regime?"
          description={`“${pendingDelete.name}” will be removed permanently. If it is still linked to customers or sales, the delete may fail.`}
          confirmLabel="Delete regime"
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            const fd = new FormData();
            fd.set("id", pendingDelete.id);
            await deleteTaxRegimeAction(fd);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </div>
  );
}
