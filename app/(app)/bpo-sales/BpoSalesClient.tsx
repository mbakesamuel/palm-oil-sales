"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkingPeriod } from "@/contexts/WorkingPeriodContext";
import type { BpoOutboundResult } from "@/app/(app)/stock/bpo-outbound/actions";

type VariantOpt = { id: string; label: string };
type Line = { productVariantId: string; qtyUnits: string };
type PaymentMode = "CASH" | "CREDIT";

function defaultDateWithinBounds(minIso: string | null, maxIso: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (minIso && today < minIso) return minIso;
  if (maxIso && today > maxIso) return maxIso;
  return today;
}

type SaleRow = {
  id: string;
  invoiceNo: string;
  soldAtIso: string;
  paymentMethod: "CASH" | "CREDIT";
  customerName: string;
  grossAmount: string;
  employeeLabel: string | null;
  lines: Array<{ variantLabel: string; qtyUnits: string; lineGross: string }>;
};

export function BpoSalesClient(props: {
  variants: VariantOpt[];
  sales: SaleRow[];
  canPost: boolean;
  botaAvailable: boolean;
  createSaleAction: (formData: FormData) => Promise<BpoOutboundResult>;
}) {
  const { variants, sales, canPost, botaAvailable, createSaleAction } = props;
  const router = useRouter();
  const workingPeriod = useWorkingPeriod();
  const defaultSaleDate = defaultDateWithinBounds(
    workingPeriod.workingMonthStartIso,
    workingPeriod.workingMonthEndIso,
  );
  const [paymentMode, setPaymentMode] = React.useState<PaymentMode>("CASH");
  const [collectedProduct, setCollectedProduct] = React.useState<"BOTTLED_PALM_OIL" | "LOOSE_PALM_OIL">(
    "BOTTLED_PALM_OIL",
  );
  const [lines, setLines] = React.useState<Line[]>([
    { productVariantId: variants[0]?.id ?? "", qtyUnits: "0" },
  ]);
  const [lastSaleReceipt, setLastSaleReceipt] = React.useState<{
    id: string;
    invoiceNo: string;
  } | null>(null);
  const [banner, setBanner] = React.useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Bottled Palm Oil sales</h1>
        <p className="text-sm opacity-75">
          Post cash or employee credit BPO sales at Bota. Approved variant prices are tax-inclusive; no extra tax is
          added at checkout.
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
          {banner.text}
          {lastSaleReceipt ? (
            <Link
              href={`/bpo-sales/${lastSaleReceipt.id}/receipt`}
              className="ml-3 underline underline-offset-4"
            >
              Print receipt
            </Link>
          ) : null}
        </div>
      ) : null}

      {!botaAvailable ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 p-4 text-sm">
          Create a sales point named Bota before posting BPO sales.
        </div>
      ) : null}

      <form
        className="space-y-4 rounded-lg border border-border p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("lines", JSON.stringify(lines));
          fd.set("paymentMode", paymentMode);
          fd.set("collectedProduct", collectedProduct);
          fd.set(
            "postingFinancialYear",
            workingPeriod.openFinancialYear != null ? String(workingPeriod.openFinancialYear) : "",
          );
          fd.set("postingCalendarYear", String(workingPeriod.workingCalendarYear));
          fd.set("postingCalendarMonth", String(workingPeriod.workingCalendarMonth));
          setBusy(true);
          setBanner(null);
          try {
            const r = await createSaleAction(fd);
            if (r.ok) {
              if (r.id) {
                setLastSaleReceipt({ id: r.id, invoiceNo: r.invoiceNo ?? "receipt" });
              } else {
                setLastSaleReceipt(null);
              }
              setBanner({
                type: "ok",
                text: `BPO sale posted${r.invoiceNo ? ` (${r.invoiceNo})` : ""}.`,
              });
              router.refresh();
            } else {
              setBanner({ type: "err", text: r.error });
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="font-semibold">Post sale</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="grid gap-2 rounded-md border border-border p-3 text-sm">
            <span className="font-medium">Payment</span>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            >
              <option value="CASH">Cash</option>
              <option value="CREDIT">Employee credit</option>
            </select>
          </label>
          <div className="rounded-md border border-border p-3 text-sm sm:col-span-2">
            <div className="font-medium">Working month</div>
            <div className="mt-1 opacity-75">{workingPeriod.workingMonthLabel}</div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Sale date</label>
            <input
              type="date"
              name="saleDate"
              min={workingPeriod.workingMonthStartIso ?? undefined}
              max={workingPeriod.workingMonthEndIso ?? undefined}
              defaultValue={defaultSaleDate}
              required
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
            {workingPeriod.workingMonthStartIso && workingPeriod.workingMonthEndIso ? (
              <p className="text-xs opacity-70">
                Sales date must be between {workingPeriod.workingMonthStartIso} and{" "}
                {workingPeriod.workingMonthEndIso}.
              </p>
            ) : null}
          </div>
        </div>
        {paymentMode === "CREDIT" ? (
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Matricule</label>
              <input
                name="employeeMatricule"
                required
                className="rounded-md border border-border bg-transparent px-3 py-2"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Employee name</label>
              <input name="employeeName" required className="rounded-md border border-border bg-transparent px-3 py-2" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Estate</label>
              <input name="employeeEstate" required className="rounded-md border border-border bg-transparent px-3 py-2" />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Collected product</label>
              <select
                value={collectedProduct}
                onChange={(e) => setCollectedProduct(e.target.value as "BOTTLED_PALM_OIL" | "LOOSE_PALM_OIL")}
                className="rounded-md border border-border bg-transparent px-3 py-2"
              >
                <option value="BOTTLED_PALM_OIL">Bottled Palm Oil</option>
                <option value="LOOSE_PALM_OIL">Loose Palm Oil</option>
              </select>
            </div>
            {collectedProduct === "LOOSE_PALM_OIL" ? (
              <div className="sm:col-span-4 rounded-md border border-amber-600/40 bg-amber-600/5 p-3 text-sm">
                Loose Palm Oil credit capture is reserved until the loose palm oil sales flow is wired.
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2">
          <div className="flex justify-between">
            <div className="text-sm font-medium">Lines</div>
            <button
              type="button"
              className="text-sm underline"
              onClick={() => setLines((prev) => [...prev, { productVariantId: variants[0]?.id ?? "", qtyUnits: "0" }])}
            >
              Add line
            </button>
          </div>
          {lines.map((l, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-12">
              <select
                className="sm:col-span-7 rounded-md border border-border bg-transparent px-3 py-2"
                value={l.productVariantId}
                onChange={(e) =>
                  setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, productVariantId: e.target.value } : x)))
                }
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <input
                className="sm:col-span-3 rounded-md border border-border bg-transparent px-3 py-2"
                value={l.qtyUnits}
                inputMode="decimal"
                onChange={(e) =>
                  setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, qtyUnits: e.target.value } : x)))
                }
              />
              <button
                type="button"
                className="sm:col-span-2 text-sm underline disabled:opacity-50"
                disabled={lines.length === 1}
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          disabled={
            !canPost ||
            !botaAvailable ||
            variants.length === 0 ||
            busy ||
            (paymentMode === "CREDIT" && collectedProduct === "LOOSE_PALM_OIL")
          }
          className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Post sale
        </button>
        {!canPost ? (
          <p className="text-xs opacity-70">Only Bota-authorized supervisors/managers can post BPO sales.</p>
        ) : null}
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent BPO sales</h2>
        <div className="space-y-3">
          {sales.map((s) => (
            <div key={s.invoiceNo} className="rounded-lg border border-border p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-semibold">{s.invoiceNo}</div>
                  <div className="text-xs opacity-75">
                    {s.soldAtIso} · {s.paymentMethod === "CREDIT" ? "Credit" : "Cash"} · {s.customerName}
                  </div>
                  {s.employeeLabel ? <div className="text-xs opacity-70 mt-1">{s.employeeLabel}</div> : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-sm font-medium tabular-nums">{s.grossAmount}</div>
                  <Link href={`/bpo-sales/${s.id}/receipt`} className="rounded-md border border-border px-3 py-1.5 text-xs">
                    Print receipt
                  </Link>
                </div>
              </div>
              <ul className="mt-2 text-sm space-y-1">
                {s.lines.map((l) => (
                  <li key={`${s.invoiceNo}-${l.variantLabel}`} className="flex justify-between gap-3">
                    <span>{l.variantLabel}</span>
                    <span className="tabular-nums">{l.qtyUnits}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {sales.length === 0 ? (
            <div className="rounded-lg border border-border p-4 text-sm opacity-75">No BPO sales yet.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
