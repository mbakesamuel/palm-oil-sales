"use client";

import * as React from "react";
import { ReportHeader } from "@/components/ReportHeader";

function trimQty(qty: string): string {
  if (!qty.includes(".")) return qty;
  const trimmed = qty.replace(/0+$/, "").replace(/\.$/, "");
  return trimmed || "0";
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type StockReceiptVoucherModel = {
  receiptNo: string;
  status: "DRAFT" | "POSTED" | "DISPATCHED" | "RECEIVED" | "CANCELLED";
  salesPointName: string;
  receivedAtIso: string;
  supplierLabel: string;
  notes: string | null;
  createdByName: string;
  createdAtIso: string;
  postedByName: string | null;
  postedAtIso: string | null;
  lines: Array<{
    lineNo: number;
    productName: string;
    storageLocationName: string;
    uom: string;
    qty: string;
  }>;
};

export function StockReceiptVoucher(props: {
  companyName: string;
  department: string | null;
  logoSrc?: string | null;
  receipt: StockReceiptVoucherModel;
}) {
  const { companyName, department, logoSrc, receipt } = props;
  const isDraft = receipt.status === "DRAFT";

  return (
    <article className="text-black bg-white max-w-3xl mx-auto print:max-w-none print:mx-0">
      <header className="border-b border-black/20 pb-4 mb-6">
        <ReportHeader
          companyName={companyName}
          department={department}
          logoSrc={logoSrc}
          title="Stock Receipt Voucher"
        />
      </header>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-2xl font-bold tabular-nums">{receipt.receiptNo}</p>
          <p className="mt-1">
            <span
              className={[
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                isDraft
                  ? "border-amber-700 text-amber-800 bg-amber-100"
                  : receipt.status === "POSTED"
                    ? "border-emerald-700 text-emerald-800 bg-emerald-100"
                    : "border-black/40 text-black/70 bg-black/5",
              ].join(" ")}
            >
              {receipt.status}
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-black/15 p-3 text-sm sm:min-w-[240px]">
          <p className="text-xs font-semibold uppercase opacity-70 mb-1">Sales point</p>
          <p className="font-semibold">{receipt.salesPointName}</p>
          <p className="opacity-80 mt-1">
            <span className="opacity-70">Received on:</span> {formatDate(receipt.receivedAtIso)}
          </p>
          <p className="opacity-80">
            <span className="opacity-70">Supplier:</span> {receipt.supplierLabel}
          </p>
        </div>
      </div>

      {isDraft ? (
        <p className="mb-4 text-xs italic opacity-80">
          This is a draft voucher. Hand this printout to the responsible
          supervisor for verification and posting.
        </p>
      ) : null}

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left border border-black/25 py-2 px-2 w-10">#</th>
              <th className="text-left border border-black/25 py-2 px-2">Product</th>
              <th className="text-left border border-black/25 py-2 px-2">Location</th>
              <th className="text-left border border-black/25 py-2 px-2 w-20">UOM</th>
              <th className="text-right border border-black/25 py-2 px-2 w-32">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((l) => (
              <tr key={l.lineNo}>
                <td className="border border-black/10 py-2 px-2 tabular-nums opacity-80 align-top">
                  {l.lineNo}
                </td>
                <td className="border border-black/10 py-2 px-2 align-top font-medium">
                  {l.productName}
                </td>
                <td className="border border-black/10 py-2 px-2 align-top opacity-80">
                  {l.storageLocationName}
                </td>
                <td className="border border-black/10 py-2 px-2 align-top opacity-80">
                  {l.uom}
                </td>
                <td className="border border-black/10 py-2 px-2 text-right tabular-nums align-top font-medium">
                  {trimQty(l.qty)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {receipt.notes ? (
        <div className="mb-6 text-sm">
          <p className="font-semibold uppercase text-xs opacity-70 mb-1">Notes</p>
          <p>{receipt.notes}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm mt-12">
        <div className="border-t border-black/30 pt-2">
          <p className="text-xs uppercase opacity-70 font-semibold">Drafted by</p>
          <p className="font-medium mt-1">{receipt.createdByName}</p>
          <p className="text-xs opacity-70">{formatDateTime(receipt.createdAtIso)}</p>
        </div>
        <div className="border-t border-black/30 pt-2">
          <p className="text-xs uppercase opacity-70 font-semibold">
            {isDraft ? "Posted by (supervisor)" : "Posted by"}
          </p>
          {receipt.postedByName ? (
            <>
              <p className="font-medium mt-1">{receipt.postedByName}</p>
              <p className="text-xs opacity-70">{formatDateTime(receipt.postedAtIso)}</p>
            </>
          ) : (
            <p className="mt-6 text-xs opacity-60">
              ___________________________ (Name &amp; signature)
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
