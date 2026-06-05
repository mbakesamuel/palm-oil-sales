"use client";

import * as React from "react";
import { DocumentStatusStamp } from "@/components/DocumentStatusStamp";
import { ReportHeader } from "@/components/ReportHeader";
import { ValidationStatus } from "@/lib/domain";
import { printStampLabelForValidationStatus } from "@/lib/print-document-stamp";

function moneyLabel(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} XAF`;
}

function formatIsoDateOnly(iso: string | null | undefined) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`));
  } catch {
    return iso;
  }
}

function formatDisplayDate(iso: string) {
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

export type SalePrintModel = {
  invoiceNo: string;
  status: ValidationStatus | string;
  soldAtIso: string;
  vehicleNumber?: string | null;
  dateIssuedIso?: string | null;
  deliveryOrderNo?: string | null;
  customerName: string;
  /** Walk-in bottle sale — name comes from clerk entry at checkout. */
  isWalkInCustomer: boolean;
  taxpayerId: string | null;
  /** From invoice tax snapshots (not the customer’s current regime). */
  vatApplies: boolean;
  /** Bottle sales use unit qty and tax-inclusive line pricing. */
  isBottleSale: boolean;
  appliedTaxLines: Array<{
    label: string;
    ratePercentLabel: string;
    amount: string;
  }>;
  lines: Array<{
    lineNo: number;
    productName: string;
    productCat: string;
    qty: string;
    unitPrice: string;
    lineNet: string;
  }>;
  netAmount: string;
  /** Legacy total VAT only; use appliedTaxLines for full tax breakdown. */
  vatAmount: string;
  grossAmount: string;
  payments: Array<{
    methodName: string;
    kind: string;
    amount: string;
    chequeNo: string | null;
    bank: string | null;
    traiteNo: string | null;
    traiteIssuedOn: string | null;
    traiteMaturityOn: string | null;
    paidAtIso: string;
  }>;
};

export function SalePrint(props: {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  logoSrc?: string | null;
  sale: SalePrintModel;
}) {
  const { companyName, department, companyPhone, companyAddress, logoSrc, sale } = props;
  const stampLabel = printStampLabelForValidationStatus(sale.status);

  return (
    <article className="relative text-black bg-white max-w-3xl mx-auto print:max-w-none print:mx-0">
      {stampLabel ? <DocumentStatusStamp label={stampLabel} /> : null}
      <header className="border-b border-black/20 pb-4 mb-6">
        <ReportHeader
          companyName={companyName}
          department={department}
          logoSrc={logoSrc}
          title="Sales invoice"
        />
        {companyAddress || companyPhone ? (
          <div className="text-center text-sm opacity-90 space-y-0.5">
            {companyAddress ? <p>{companyAddress}</p> : null}
            {companyPhone ? <p>Tel: {companyPhone}</p> : null}
          </div>
        ) : null}
      </header>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm">
            <span className="opacity-70">Invoice</span>{" "}
            <span className="font-semibold tabular-nums">{sale.invoiceNo}</span>
          </p>
          <p className="text-sm">
            <span className="opacity-70">Sold at</span>{" "}
            <span className="font-medium">{formatDisplayDate(sale.soldAtIso)}</span>
          </p>
          {sale.vehicleNumber ? (
            <p className="text-sm">
              <span className="opacity-70">Vehicle</span>{" "}
              <span className="font-medium">{sale.vehicleNumber}</span>
            </p>
          ) : null}
          {sale.dateIssuedIso ? (
            <p className="text-sm">
              <span className="opacity-70">Date issued</span>{" "}
              <span className="font-medium">{formatDisplayDate(sale.dateIssuedIso)}</span>
            </p>
          ) : null}
          {sale.deliveryOrderNo ? (
            <p className="text-sm">
              <span className="opacity-70">Delivery order</span>{" "}
              <span className="font-medium tabular-nums">{sale.deliveryOrderNo}</span>
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-black/15 p-3 text-sm sm:min-w-[220px]">
          <p className="text-xs font-semibold uppercase opacity-70 mb-1">Customer</p>
          {sale.isWalkInCustomer ? (
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-0.5">
              Walk-in
            </p>
          ) : null}
          <p className="font-semibold">{sale.customerName}</p>
          {sale.taxpayerId ? <p className="opacity-80">Tax ID: {sale.taxpayerId}</p> : null}
          <p className="opacity-80">
            VAT (on invoice): {sale.vatApplies ? "charged" : "none"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left border border-black/25 py-2 px-2 w-10">#</th>
              <th className="text-left border border-black/25 py-2 px-2">Product</th>
              <th className="text-right border border-black/25 py-2 px-2">
                {sale.isBottleSale ? "Qty (units)" : "Qty (kg)"}
              </th>
              <th className="text-right border border-black/25 py-2 px-2">
                {sale.isBottleSale ? "Unit price (incl.)" : "Unit price"}
              </th>
              <th className="text-right border border-black/25 py-2 px-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((l) => (
              <tr key={l.lineNo}>
                <td className="border border-black/10 py-2 px-2 tabular-nums opacity-80 align-top">
                  {l.lineNo}
                </td>
                <td className="border border-black/10 py-2 px-2 align-top">
                  <span className="font-medium">{l.productName}</span>
                  <span className="block text-xs opacity-70">{l.productCat}</span>
                </td>
                <td className="border border-black/10 py-2 px-2 text-right tabular-nums align-top">
                  {l.qty}
                </td>
                <td className="border border-black/10 py-2 px-2 text-right tabular-nums align-top">
                  {moneyLabel(l.unitPrice)}
                </td>
                <td className="border border-black/10 py-2 px-2 text-right tabular-nums align-top">
                  {moneyLabel(l.lineNet)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8">
        <div className="text-sm space-y-1 min-w-[240px]">
          <div className="flex justify-between gap-8">
            <span className="opacity-70">
              {sale.isBottleSale ? "Total (tax-inclusive)" : "Subtotal (ex tax)"}
            </span>
            <span className="tabular-nums">{moneyLabel(sale.netAmount)}</span>
          </div>
          {!sale.isBottleSale
            ? sale.appliedTaxLines.map((t, i) => (
                <div key={`${t.label}-${i}`} className="flex justify-between gap-8">
                  <span className="opacity-70">
                    {t.label} ({t.ratePercentLabel}%)
                  </span>
                  <span className="tabular-nums">{moneyLabel(t.amount)}</span>
                </div>
              ))
            : null}
          <div className="flex justify-between gap-8 border-t border-black/20 pt-2 font-semibold">
            <span>{sale.isBottleSale ? "Amount due" : "Grand total"}</span>
            <span className="tabular-nums">{moneyLabel(sale.grossAmount)}</span>
          </div>
          {sale.isBottleSale ? (
            <p className="text-xs opacity-70 pt-1">Prices include tax; no VAT is added.</p>
          ) : null}
        </div>
      </div>

      {sale.payments.length > 0 ? (
        <section className="mb-8">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-2">Payments recorded</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/25">
                <th className="text-left py-2">Method</th>
                <th className="text-left py-2">Date</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-left py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {sale.payments.map((p, i) => (
                <tr key={i} className="border-b border-black/10">
                  <td className="py-2">{p.methodName}</td>
                  <td className="py-2">{formatDisplayDate(p.paidAtIso)}</td>
                  <td className="py-2 text-right tabular-nums">{moneyLabel(p.amount)}</td>
                  <td className="py-2 text-xs opacity-90">
                    {(() => {
                      const bits: string[] = [];
                      if (p.kind === "TRAITE") {
                        if (p.traiteNo) bits.push(`Traite: ${p.traiteNo}`);
                        if (p.bank) bits.push(`Bank: ${p.bank}`);
                        if (p.traiteIssuedOn)
                          bits.push(`Issued: ${formatIsoDateOnly(p.traiteIssuedOn)}`);
                        if (p.traiteMaturityOn)
                          bits.push(`Matures: ${formatIsoDateOnly(p.traiteMaturityOn)}`);
                      } else {
                        if (p.chequeNo) bits.push(`Chq: ${p.chequeNo}`);
                        if (p.bank) bits.push(`Bank: ${p.bank}`);
                      }
                      return bits.length > 0 ? bits.join(" · ") : "—";
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className="mt-16 pt-10 border-t border-black/15 text-sm flex justify-end print:mt-24">
        <div className="text-right">
          <p className="opacity-70 mb-8">Manager, Local Sales</p>
        </div>
      </footer>
    </article>
  );
}

