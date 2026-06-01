"use client";

import * as React from "react";
import { DocumentStatusStamp } from "@/components/DocumentStatusStamp";
import { ReportHeader } from "@/components/ReportHeader";
import { printStampLabelForStockDocStatus } from "@/lib/print-document-stamp";

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

export type StockTransferVoucherModel = {
  transferNo: string;
  status: "DRAFT" | "POSTED" | "DISPATCHED" | "RECEIVED" | "CANCELLED";
  fromSalesPointName: string;
  toSalesPointName: string;
  dispatchedAtIso: string | null;
  receivedAtIso: string | null;
  notes: string | null;
  createdByName: string;
  createdAtIso: string;
  dispatchedByName: string | null;
  receivedByName: string | null;
  lines: Array<{
    lineNo: number;
    productName: string;
    fromStorageLocationName: string;
    toStorageLocationName: string | null;
    uom: string;
    qty: string;
  }>;
};

export function StockTransferVoucher(props: {
  companyName: string;
  department: string | null;
  logoSrc?: string | null;
  transfer: StockTransferVoucherModel;
}) {
  const { companyName, department, logoSrc, transfer } = props;
  const isDraft = transfer.status === "DRAFT";
  const stampLabel = printStampLabelForStockDocStatus(transfer.status);

  return (
    <article className="relative text-black bg-white max-w-3xl mx-auto print:max-w-none print:mx-0">
      {stampLabel ? <DocumentStatusStamp label={stampLabel} /> : null}
      <header className="border-b border-black/20 pb-4 mb-6">
        <ReportHeader
          companyName={companyName}
          department={department}
          logoSrc={logoSrc}
          title="Stock Transfer Voucher"
        />
      </header>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-2xl font-bold tabular-nums">{transfer.transferNo}</p>
          <p className="mt-1">
            <span
              className={[
                "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                isDraft
                  ? "border-amber-700 text-amber-800 bg-amber-100"
                  : transfer.status === "DISPATCHED"
                    ? "border-sky-700 text-sky-800 bg-sky-100"
                    : transfer.status === "RECEIVED"
                      ? "border-emerald-700 text-emerald-800 bg-emerald-100"
                      : "border-black/40 text-black/70 bg-black/5",
              ].join(" ")}
            >
              {transfer.status}
            </span>
          </p>
        </div>

        <div className="rounded-lg border border-black/15 p-3 text-sm sm:min-w-[260px]">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-xs uppercase opacity-70 font-semibold">From</span>
            <span className="font-semibold">{transfer.fromSalesPointName}</span>
            <span className="text-xs uppercase opacity-70 font-semibold">To</span>
            <span className="font-semibold">{transfer.toSalesPointName}</span>
            <span className="text-xs uppercase opacity-70 font-semibold">Dispatched</span>
            <span>{formatDate(transfer.dispatchedAtIso)}</span>
            <span className="text-xs uppercase opacity-70 font-semibold">Received</span>
            <span>{formatDate(transfer.receivedAtIso)}</span>
          </div>
        </div>
      </div>

      {isDraft ? (
        <p className="mb-4 text-xs italic opacity-80">
          This is a draft voucher. Hand this printout to the responsible
          supervisor for verification and dispatch.
        </p>
      ) : null}

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left border border-black/25 py-2 px-2 w-10">#</th>
              <th className="text-left border border-black/25 py-2 px-2">Product</th>
              <th className="text-left border border-black/25 py-2 px-2">From</th>
              <th className="text-left border border-black/25 py-2 px-2">To</th>
              <th className="text-left border border-black/25 py-2 px-2 w-20">UOM</th>
              <th className="text-right border border-black/25 py-2 px-2 w-32">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {transfer.lines.map((l) => (
              <tr key={l.lineNo}>
                <td className="border border-black/10 py-2 px-2 tabular-nums opacity-80 align-top">
                  {l.lineNo}
                </td>
                <td className="border border-black/10 py-2 px-2 align-top font-medium">
                  {l.productName}
                </td>
                <td className="border border-black/10 py-2 px-2 align-top opacity-80">
                  {l.fromStorageLocationName}
                </td>
                <td className="border border-black/10 py-2 px-2 align-top opacity-80">
                  {l.toStorageLocationName ?? "Pending receipt"}
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

      {transfer.notes ? (
        <div className="mb-6 text-sm">
          <p className="font-semibold uppercase text-xs opacity-70 mb-1">Notes</p>
          <p>{transfer.notes}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm mt-12">
        <div className="border-t border-black/30 pt-2">
          <p className="text-xs uppercase opacity-70 font-semibold">Drafted by</p>
          <p className="font-medium mt-1">{transfer.createdByName}</p>
          <p className="text-xs opacity-70">{formatDateTime(transfer.createdAtIso)}</p>
        </div>
        <div className="border-t border-black/30 pt-2">
          <p className="text-xs uppercase opacity-70 font-semibold">
            {isDraft ? "Dispatched by (supervisor)" : "Dispatched by"}
          </p>
          {transfer.dispatchedByName ? (
            <>
              <p className="font-medium mt-1">{transfer.dispatchedByName}</p>
              <p className="text-xs opacity-70">{formatDateTime(transfer.dispatchedAtIso)}</p>
            </>
          ) : (
            <p className="mt-6 text-xs opacity-60">
              _______________________ (Name &amp; signature)
            </p>
          )}
        </div>
        <div className="border-t border-black/30 pt-2">
          <p className="text-xs uppercase opacity-70 font-semibold">
            Received at destination
          </p>
          {transfer.receivedByName ? (
            <>
              <p className="font-medium mt-1">{transfer.receivedByName}</p>
              <p className="text-xs opacity-70">{formatDateTime(transfer.receivedAtIso)}</p>
            </>
          ) : (
            <p className="mt-6 text-xs opacity-60">
              _______________________ (Name &amp; signature)
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
