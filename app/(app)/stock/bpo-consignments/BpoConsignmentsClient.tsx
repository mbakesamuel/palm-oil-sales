"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BpoMovementStatus } from "@/lib/domain";
import type { BpoMutationResult } from "./actions";

type SalesPointOpt = { id: number; name: string };
type VariantOpt = { id: string; label: string };
type AvailabilityRow = {
  salesPointId: number;
  productVariantId: string;
  availableQtyUnits: string;
};
type DraftLine = { productVariantId: string; qtyUnits: string };
type MovementRow = {
  id: string;
  voucherNo: string;
  status: BpoMovementStatus;
  sourceSalesPointName: string;
  destinationSalesPointName: string;
  movementDateIso: string;
  note: string | null;
  discrepancyNote: string | null;
  canSenderValidate: boolean;
  canBotaValidate: boolean;
  canReject: boolean;
  canPrintReceiptVoucher: boolean;
  lines: Array<{
    id: string;
    productVariantId: string;
    variantLabel: string;
    voucherQtyUnits: string;
    actualQtyUnits: string | null;
  }>;
};

export function BpoConsignmentsClient(props: {
  salesPoints: SalesPointOpt[];
  variants: VariantOpt[];
  availability: AvailabilityRow[];
  movements: MovementRow[];
  botaSalesPointId: number | null;
  defaultSourceSalesPointId: number | null;
  salesPointLocked: boolean;
  canCreateVoucher: boolean;
  canPrintCreatedVoucher: boolean;
  createAction: (formData: FormData) => Promise<BpoMutationResult>;
  senderValidateAction: (formData: FormData) => Promise<BpoMutationResult>;
  botaValidateAction: (formData: FormData) => Promise<BpoMutationResult>;
  rejectAction: (formData: FormData) => Promise<BpoMutationResult>;
}) {
  const {
    salesPoints,
    variants,
    availability,
    movements,
    botaSalesPointId,
    defaultSourceSalesPointId,
    salesPointLocked,
    canCreateVoucher,
    canPrintCreatedVoucher,
    createAction,
    senderValidateAction,
    botaValidateAction,
    rejectAction,
  } = props;
  const router = useRouter();
  const [sourceSalesPointId, setSourceSalesPointId] = React.useState(
    String(
      defaultSourceSalesPointId ??
        salesPoints.find((sp) => sp.id !== botaSalesPointId)?.id ??
        "",
    ),
  );
  const [lines, setLines] = React.useState<DraftLine[]>([
    { productVariantId: variants[0]?.id ?? "", qtyUnits: "0" },
  ]);
  const [banner, setBanner] = React.useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);
  const [lastCreatedPrint, setLastCreatedPrint] = React.useState<{
    id: string;
    voucherNo: string;
  } | null>(null);
  const [lastConfirmationPrint, setLastConfirmationPrint] = React.useState<{
    id: string;
    voucherNo: string;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function run(
    action: (fd: FormData) => Promise<BpoMutationResult>,
    fd: FormData,
    okText: string,
  ) {
    setBusy(true);
    setBanner(null);
    setLastCreatedPrint(null);
    setLastConfirmationPrint(null);
    try {
      const r = await action(fd);
      if (r.ok) {
        setBanner({ type: "ok", text: okText });
        router.refresh();
      } else {
        setBanner({ type: "err", text: r.error });
      }
      return r;
    } finally {
      setBusy(false);
    }
  }

  const effectiveSourceSalesPointId =
    salesPointLocked && defaultSourceSalesPointId != null
      ? defaultSourceSalesPointId
      : Number.parseInt(sourceSalesPointId, 10);
  const isBotaSalesPoint =
    defaultSourceSalesPointId != null &&
    botaSalesPointId != null &&
    defaultSourceSalesPointId === botaSalesPointId;

  function parseDec(raw: string) {
    const n = Number.parseFloat(String(raw ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function availableForLine(line: DraftLine) {
    if (!Number.isFinite(effectiveSourceSalesPointId)) return 0;
    const row = availability.find(
      (a) =>
        a.salesPointId === effectiveSourceSalesPointId &&
        a.productVariantId === line.productVariantId,
    );
    return parseDec(row?.availableQtyUnits ?? "0");
  }

  function fmtUnits(value: number) {
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(
      value,
    );
  }

  const draftAvailabilityError = (() => {
    if (!Number.isFinite(effectiveSourceSalesPointId))
      return "Select a source sales point.";
    const requestedByVariant = new Map<string, number>();
    for (const line of lines) {
      if (!line.productVariantId) continue;
      requestedByVariant.set(
        line.productVariantId,
        (requestedByVariant.get(line.productVariantId) ?? 0) +
          parseDec(line.qtyUnits),
      );
    }
    for (const [variantId, requested] of requestedByVariant) {
      const available =
        availability
          .filter(
            (a) =>
              a.salesPointId === effectiveSourceSalesPointId &&
              a.productVariantId === variantId,
          )
          .reduce((sum, row) => sum + parseDec(row.availableQtyUnits), 0) || 0;
      if (requested > available + 1e-9) {
        const variantLabel =
          variants.find((v) => v.id === variantId)?.label ?? "selected variant";
        return `${variantLabel}: requested ${fmtUnits(requested)}, available ${fmtUnits(available)}.`;
      }
    }
    return null;
  })();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">
          {isBotaSalesPoint
            ? "Consignment Transfer/Confirmation."
            : "BPO consignments to Bota"}
        </h1>
        <p className="text-sm opacity-75">
          {isBotaSalesPoint
            ? "Confirmation of consignment transfer to Bota. Ensure that the actual received physical quantity is the same as the voucher quantity."
            : "Clerks raise vouchers, sender supervisors approve dispatch, and Bota validates actual received quantity before stock moves."}
        </p>
      </div>

      {banner ? (
        <div
          className={
            banner.type === "ok"
              ? "rounded-lg border border-emerald-600/40 bg-emerald-600/5 px-4 py-3 text-sm"
              : "rounded-lg border border-red-600/40 bg-red-600/5 px-4 py-3 text-sm"
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <span>{banner.text}</span>
            {lastConfirmationPrint ? (
              <a
                href={`/stock/bpo-consignments/${lastConfirmationPrint.id}/confirmation`}
                className="underline underline-offset-4"
              >
                Print confirmation receipt
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      {botaSalesPointId == null ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 p-4 text-sm">
          Create a sales point named Bota before using this workflow.
        </div>
      ) : null}

      {!isBotaSalesPoint && canCreateVoucher ? (
        <form
          className="space-y-4 rounded-lg border border-black/10 dark:border-white/10 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (draftAvailabilityError) {
              setBanner({ type: "err", text: draftAvailabilityError });
              return;
            }
            const fd = new FormData(e.currentTarget);
            fd.set("lines", JSON.stringify(lines));
            void run(createAction, fd, "Consignment voucher created.").then((r) => {
              if (r?.ok && r.id && canPrintCreatedVoucher) {
                setLastCreatedPrint({ id: r.id, voucherNo: r.voucherNo ?? "voucher" });
              }
              if (!r?.ok) setLastCreatedPrint(null);
              setLastConfirmationPrint(null);
            });
          }}
        >
          <h2 className="font-semibold">Raise sender voucher</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Source sales point</label>
              {salesPointLocked && defaultSourceSalesPointId != null ? (
                <>
                  <input
                    type="hidden"
                    name="sourceSalesPointId"
                    value={defaultSourceSalesPointId}
                  />
                  <div className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm">
                    {salesPoints.find((s) => s.id === defaultSourceSalesPointId)
                      ?.name ?? "Assigned sales point"}
                  </div>
                </>
              ) : (
                <select
                  name="sourceSalesPointId"
                  className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  required
                  value={sourceSalesPointId}
                  onChange={(e) => setSourceSalesPointId(e.target.value)}
                >
                  <option value="">Select source</option>
                  {salesPoints
                    .filter((sp) => sp.id !== botaSalesPointId)
                    .map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                </select>
              )}
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                name="movementDate"
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Note</label>
              <input
                name="note"
                className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Voucher lines</div>
              <button
                type="button"
                className="text-sm underline"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { productVariantId: variants[0]?.id ?? "", qtyUnits: "0" },
                  ])
                }
              >
                Add line
              </button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-12">
                <select
                  className="sm:col-span-7 rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  value={line.productVariantId}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x, i) =>
                        i === idx
                          ? { ...x, productVariantId: e.target.value }
                          : x,
                      ),
                    )
                  }
                  required
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <input
                  className="sm:col-span-3 rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                  inputMode="decimal"
                  value={line.qtyUnits}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, qtyUnits: e.target.value } : x,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="sm:col-span-2 text-sm underline disabled:opacity-50"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  Remove
                </button>
                <p className="sm:col-span-12 text-xs opacity-70">
                  Available at source: {fmtUnits(availableForLine(line))} units
                </p>
              </div>
            ))}
          </div>

          {draftAvailabilityError ? (
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {draftAvailabilityError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={
                busy ||
                variants.length === 0 ||
                botaSalesPointId == null ||
                Boolean(draftAvailabilityError)
              }
              className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Create voucher
            </button>
            {canPrintCreatedVoucher && lastCreatedPrint ? (
              <a
                href={`/stock/bpo-consignments/${lastCreatedPrint.id}/voucher`}
                className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium"
              >
                Print voucher
              </a>
            ) : null}
          </div>
        </form>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Transfer documents</h2>
        <div className="space-y-3">
          {movements.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-black/10 dark:border-white/10 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{m.voucherNo}</div>
                  <div className="text-xs opacity-75">
                    {m.sourceSalesPointName} to {m.destinationSalesPointName} ·{" "}
                    {m.movementDateIso} · {m.status}
                  </div>
                  {m.note ? (
                    <div className="text-xs opacity-70 mt-1">{m.note}</div>
                  ) : null}
                  {m.discrepancyNote ? (
                    <div className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                      Discrepancy: {m.discrepancyNote}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.canSenderValidate ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const fd = new FormData();
                        fd.set("id", m.id);
                        void run(
                          senderValidateAction,
                          fd,
                          "Sender voucher validated.",
                        );
                      }}
                      className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs"
                    >
                      Validate
                    </button>
                  ) : null}
                  {m.canReject ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const reason =
                          window.prompt("Reject reason (optional)") ?? "";
                        const fd = new FormData();
                        fd.set("id", m.id);
                        fd.set("reason", reason);
                        void run(rejectAction, fd, "Voucher rejected.");
                      }}
                      className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-1.5 text-xs"
                    >
                      Reject
                    </button>
                  ) : null}
                  {m.canPrintReceiptVoucher ? (
                    <a
                      href={`/stock/bpo-consignments/${m.id}/receipt`}
                      className="rounded-md border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs"
                    >
                      Print receipt voucher
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10">
                      <th className="text-left py-1.5">Variant</th>
                      <th className="text-right py-1.5">Voucher qty</th>
                      <th className="text-right py-1.5">Actual qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.lines.map((l) => (
                      <tr
                        key={l.id}
                        className="border-b border-black/5 dark:border-white/5 last:border-0"
                      >
                        <td className="py-1.5">{l.variantLabel}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {l.voucherQtyUnits}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {l.actualQtyUnits ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {m.canBotaValidate ? (
                <form
                  className="space-y-2 rounded-md border border-black/10 dark:border-white/10 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const actualLines = m.lines.map((l) => ({
                      productVariantId: l.productVariantId,
                      qtyUnits: fd.get(`actual-${l.id}`),
                      actualQtyUnits: fd.get(`actual-${l.id}`),
                    }));
                    fd.set("id", m.id);
                    fd.set("lines", JSON.stringify(actualLines));
                    void run(
                      botaValidateAction,
                      fd,
                      "Bota receipt validated and stock posted.",
                    ).then((r) => {
                      if (r?.ok && r.id) {
                        setLastConfirmationPrint({
                          id: r.id,
                          voucherNo: r.voucherNo ?? m.voucherNo,
                        });
                      }
                      setLastCreatedPrint(null);
                    });
                  }}
                >
                  <div className="text-sm font-medium">Bota cross-check</div>
                  {m.lines.map((l) => (
                    <label
                      key={l.id}
                      className="grid gap-1 sm:grid-cols-2 sm:items-center text-sm"
                    >
                      <span>{l.variantLabel}</span>
                      <input
                        name={`actual-${l.id}`}
                        inputMode="decimal"
                        defaultValue={l.actualQtyUnits ?? l.voucherQtyUnits}
                        className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
                        required
                      />
                    </label>
                  ))}
                  <input
                    name="discrepancyNote"
                    placeholder="Discrepancy note, if any"
                    className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      disabled={busy}
                      className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      Validate Bota receipt
                    </button>
                    {lastConfirmationPrint?.id === m.id ? (
                      <a
                        href={`/stock/bpo-consignments/${lastConfirmationPrint.id}/confirmation`}
                        className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium"
                      >
                        Print confirmation receipt
                      </a>
                    ) : null}
                  </div>
                </form>
              ) : null}
            </div>
          ))}
          {movements.length === 0 ? (
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 text-sm opacity-75">
              No BPO consignment documents yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
