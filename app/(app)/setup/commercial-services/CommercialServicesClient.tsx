"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export type CommercialServiceRow = {
  id: string;
  code: string;
  name: string;
  invoicePrefix: string;
  phone: string | null;
  address: string | null;
  sortOrder: number;
  isActive: boolean;
};

const inputClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-2 py-1 text-sm";
const inputMonoClass = `${inputClass} font-mono text-xs uppercase`;
const labelClass = "text-xs font-medium";
const hintClass = "text-[11px] opacity-70 mt-0.5";
const fieldRowClass = "flex items-start gap-2";
const fieldRowStretchClass = "flex items-stretch gap-2";
const fieldLabelClass = [
  labelClass,
  "shrink-0 w-[6.75rem] h-8",
  "flex items-center justify-end px-2",
  "rounded-md border border-border",
  "bg-sidebar text-sidebar-foreground",
].join(" ");
const fieldLabelStretchClass = `${fieldLabelClass} h-auto min-h-12 self-stretch`;
const fieldControlClass = "min-w-0 flex-1";

export function CommercialServicesClient(props: {
  services: CommercialServiceRow[];
  defaultServiceCode: string;
  saveCommercialService: (formData: FormData) => Promise<void>;
}) {
  const { services, defaultServiceCode, saveCommercialService } = props;
  const router = useRouter();
  const { session, refreshSession } = useAuth();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [invoicePrefix, setInvoicePrefix] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState("10");
  const [isActive, setIsActive] = React.useState(true);
  const [banner, setBanner] = React.useState<{
    type: "error" | "ok";
    text: string;
  } | null>(null);

  const editingRow = editingId
    ? services.find((s) => s.id === editingId)
    : undefined;
  const isDefaultEdit = editingRow?.code === defaultServiceCode;

  function resetForm(opts?: { clearBanner?: boolean }) {
    setEditingId(null);
    setCode("");
    setName("");
    setInvoicePrefix("");
    setPhone("");
    setAddress("");
    setSortOrder("10");
    setIsActive(true);
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

  function startEdit(row: CommercialServiceRow) {
    setEditingId(row.id);
    setCode(row.code);
    setName(row.name);
    setInvoicePrefix(row.invoicePrefix);
    setPhone(row.phone ?? "");
    setAddress(row.address ?? "");
    setSortOrder(String(row.sortOrder));
    setIsActive(row.isActive);
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
      await saveCommercialService(fd);
      closeForm({ clearBanner: false });
      const affectsCurrentUser =
        editingId != null && editingId === session?.commercialService?.id;
      if (affectsCurrentUser) {
        await refreshSession();
      }
      setBanner({
        type: "ok",
        text: affectsCurrentUser
          ? "Your service line was updated."
          : wasEdit
            ? "Service line saved."
            : "Service line created.",
      });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Could not save commercial line.",
      });
    }
  }

  const prefixHint = invoicePrefix.trim()
    ? `${invoicePrefix.trim().toUpperCase()}-YYYY-000001`
    : "PREFIX-YYYY-000001";

  return (
    <div className="space-y-8">
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
          aria-label={editingId ? "Edit Service Line" : "Add New Service Line"}
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
                {editingId ? "Edit Service Line" : "Add New Service Line"}
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
              className="mt-3 space-y-2 max-h-[min(22rem,calc(100vh-6rem))] overflow-y-auto pr-1"
            >
              {editingId ? (
                <input type="hidden" name="id" value={editingId} />
              ) : null}

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="cs-code">
                  Code
                </label>
                <div className={fieldControlClass}>
                  {isDefaultEdit ? (
                    <>
                      <input
                        id="cs-code"
                        value={code}
                        readOnly
                        className={`${inputClass} font-mono text-xs opacity-80`}
                      />
                      <input type="hidden" name="code" value={code} />
                      <p className={hintClass}>Default code cannot be changed.</p>
                    </>
                  ) : (
                    <input
                      id="cs-code"
                      name="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. rubber_sales"
                      required
                      className={`${inputClass} font-mono text-xs`}
                    />
                  )}
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="cs-name">
                  Name
                </label>
                <input
                  id="cs-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rubber Sales"
                  required
                  className={`${inputClass} ${fieldControlClass}`}
                />
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="cs-prefix">
                  Prefix
                </label>
                <div className={fieldControlClass}>
                  <input
                    id="cs-prefix"
                    name="invoicePrefix"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    placeholder="e.g. RB"
                    required
                    className={inputMonoClass}
                    autoCapitalize="characters"
                  />
                  <p className={hintClass}>
                    <span className="font-mono">{prefixHint}</span> per year
                  </p>
                </div>
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="cs-phone">
                  Phone
                </label>
                <input
                  id="cs-phone"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`${inputClass} ${fieldControlClass}`}
                />
              </div>

              <div className={fieldRowStretchClass}>
                <label className={fieldLabelStretchClass} htmlFor="cs-address">
                  Address
                </label>
                <textarea
                  id="cs-address"
                  name="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className={`${inputClass} ${fieldControlClass} min-h-12 py-1 resize-y`}
                />
              </div>

              <div className={fieldRowClass}>
                <label className={fieldLabelClass} htmlFor="cs-sort">
                  Sort
                </label>
                <input
                  id="cs-sort"
                  name="sortOrder"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className={`${inputClass} w-20 tabular-nums`}
                />
              </div>

              <div className={fieldRowClass}>
                <span className={fieldLabelClass}>Active</span>
                <label className={`${fieldControlClass} flex h-8 items-center gap-2 text-xs`}>
                  <input type="hidden" name="isActive" value="0" />
                  <input
                    type="checkbox"
                    name="isActive"
                    value="1"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Line is active
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 pl-[7.25rem]">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-brand-foreground px-3 py-1.5 text-xs font-medium"
                >
                  {editingId ? "Save changes" : "Create"}
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
          <h2 className="text-lg font-semibold">Commercial lines</h2>
          <button
            type="button"
            className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
            onClick={openAddForm}
          >
            Add New Service
          </button>
        </div>
        {services.length === 0 ? (
          <p className="text-sm opacity-75">No commercial lines yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="p-2 font-medium">Line</th>
                  <th className="p-2 font-medium">Display name</th>
                  <th className="p-2 font-medium">Invoice prefix</th>
                  <th className="p-2 font-medium">Phone</th>
                  <th className="p-2 font-medium min-w-40">Address</th>
                  <th className="p-2 font-medium w-16">Sort</th>
                  <th className="p-2 font-medium w-24">Status</th>
                  <th className="p-2 font-medium w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr
                    key={s.id}
                    className={[
                      "border-b border-border align-top",
                      editingId === s.id ? "bg-accent/15" : "",
                    ].join(" ")}
                  >
                    <td className="p-2">
                      {s.code === defaultServiceCode ? (
                        <div>
                          <div className="font-medium">Default line</div>
                          <div className="font-mono text-xs opacity-70">
                            {s.code}
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono text-xs">{s.code}</span>
                      )}
                    </td>
                    <td className="p-2 font-medium">{s.name}</td>
                    <td className="p-2">
                      <span className="font-mono text-xs">
                        {s.invoicePrefix}
                      </span>
                      <div className="text-xs opacity-60 mt-0.5">
                        · {s.invoicePrefix}-YYYY-000001
                      </div>
                    </td>
                    <td className="p-2 text-xs opacity-90">
                      {s.phone?.trim() ? s.phone : "—"}
                    </td>
                    <td
                      className="p-2 text-xs opacity-90 max-w-xs truncate"
                      title={s.address?.trim() ? s.address : undefined}
                    >
                      {s.address?.trim() ? s.address : "—"}
                    </td>
                    <td className="p-2 tabular-nums">{s.sortOrder}</td>
                    <td className="p-2">
                      {s.isActive ? (
                        <span className="inline-flex rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-border bg-accent/10 px-2 py-0.5 text-xs opacity-80">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent/25"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
