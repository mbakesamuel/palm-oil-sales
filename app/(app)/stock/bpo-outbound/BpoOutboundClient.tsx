"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkingPeriod } from "@/contexts/WorkingPeriodContext";
import type { BpoOutboundResult } from "./actions";

type VariantOpt = { id: string; label: string };
type Line = { productVariantId: string; qtyUnits: string };

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

type MovementRow = {
  voucherNo: string;
  movementDateIso: string;
  reason: string | null;
  note: string | null;
  lines: Array<{ variantLabel: string; qtyUnits: string }>;
};

export function BpoOutboundClient(props: {
  variants: VariantOpt[];
  movements: MovementRow[];
  canPost: boolean;
  botaAvailable: boolean;
  createAction: (formData: FormData) => Promise<BpoOutboundResult>;
}) {
  const { variants, movements, canPost, botaAvailable, createAction } = props;
  const router = useRouter();
  const workingPeriod = useWorkingPeriod();
  const [lines, setLines] = React.useState<Line[]>([
    { productVariantId: variants[0]?.id ?? "", qtyUnits: "0" },
  ]);
  const [banner, setBanner] = React.useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Bottled Palm Oil gift / out</h1>
        <p className="text-sm opacity-75">
          Post Bottled Palm Oil stock out of Bota through PRO, gift, or other outbound movements (not sales). Use{" "}
          <Link href="/bpo-sales" className="underline underline-offset-4">
            Bottled Palm Oil sales
          </Link>{" "}
          for cash or employee credit sales.
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
        </div>
      ) : null}

      {!botaAvailable ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 p-4 text-sm">
          Create a sales point named Bota before posting outbound BPO movements.
        </div>
      ) : null}

      <form
        className="space-y-4 rounded-lg border border-border p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("lines", JSON.stringify(lines));
          setBusy(true);
          setBanner(null);
          try {
            const r = await createAction(fd);
            if (r.ok) {
              setBanner({ type: "ok", text: "Outbound movement posted." });
              router.refresh();
            } else {
              setBanner({ type: "err", text: r.error });
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="font-semibold">Post outbound movement</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3 text-sm sm:col-span-3">
            <div className="font-medium">Working month</div>
            <div className="mt-1 opacity-75">{workingPeriod.workingMonthLabel}</div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Movement date</label>
            <input
              type="date"
              name="movementDate"
              defaultValue={todayIsoDate()}
              required
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-medium">Reason</label>
            <select
              name="reason"
              defaultValue="PRO"
              className="rounded-md border border-border bg-transparent px-3 py-2"
            >
              <option value="PRO">PRO</option>
              <option value="Gift">Gift</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-medium">Note</label>
          <input name="note" className="rounded-md border border-border bg-transparent px-3 py-2" />
        </div>
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
          disabled={!canPost || !botaAvailable || variants.length === 0 || busy}
          className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Post movement
        </button>
        {!canPost ? (
          <p className="text-xs opacity-70">Only Bota-authorized supervisors/managers can post outbound movements.</p>
        ) : null}
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent outbound movements</h2>
        <div className="space-y-3">
          {movements.map((m) => (
            <div key={m.voucherNo} className="rounded-lg border border-border p-4">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-semibold">{m.voucherNo}</div>
                  <div className="text-xs opacity-75">
                    {m.movementDateIso} · {m.reason ?? "Out"}
                  </div>
                  {m.note ? <div className="text-xs opacity-70 mt-1">{m.note}</div> : null}
                </div>
              </div>
              <ul className="mt-2 text-sm space-y-1">
                {m.lines.map((l) => (
                  <li key={`${m.voucherNo}-${l.variantLabel}`} className="flex justify-between">
                    <span>{l.variantLabel}</span>
                    <span className="tabular-nums">{l.qtyUnits}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {movements.length === 0 ? (
            <div className="rounded-lg border border-border p-4 text-sm opacity-75">No outbound movements yet.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
