"use client";

import * as React from "react";

function moneyLabel(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} XAF`;
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
  soldAtIso: string;
  customerName: string;
  taxpayerId: string | null;
  vatApplies: boolean;
  lines: Array<{
    lineNo: number;
    productName: string;
    productCat: string;
    qtyKg: string;
    unitPricePerKg: string;
    lineNet: string;
  }>;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  payments: Array<{
    method: string;
    amount: string;
    chequeNo: string | null;
    paidAtIso: string;
  }>;
};

export function SalePrint(props: {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  sale: SalePrintModel;
}) {
  const { companyName, department, companyPhone, companyAddress, sale } = props;

  return (
    <article className="text-black bg-white max-w-3xl mx-auto print:max-w-none print:mx-0">
      <header className="border-b border-black/20 pb-4 mb-6 text-center flex flex-col items-center">
        <h1 className="text-xl font-bold mt-1">{companyName}</h1>
        {department ? (
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{department}</p>
        ) : null}
        <div className="mt-2 text-sm opacity-90 space-y-0.5">
          {companyAddress ? <p>{companyAddress}</p> : null}
          {companyPhone ? <p>Tel: {companyPhone}</p> : null}
        </div>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wide">Sales invoice</h2>
          <p className="text-sm mt-1">
            <span className="opacity-70">Invoice</span>{" "}
            <span className="font-semibold tabular-nums">{sale.invoiceNo}</span>
          </p>
          <p className="text-sm">
            <span className="opacity-70">Sold at</span>{" "}
            <span className="font-medium">{formatDisplayDate(sale.soldAtIso)}</span>
          </p>
        </div>

        <div className="rounded-lg border border-black/15 p-3 text-sm sm:min-w-[220px]">
          <p className="text-xs font-semibold uppercase opacity-70 mb-1">Customer</p>
          <p className="font-semibold">{sale.customerName}</p>
          {sale.taxpayerId ? <p className="opacity-80">Tax ID: {sale.taxpayerId}</p> : null}
          <p className="opacity-80">VAT: {sale.vatApplies ? "applies" : "exempt"}</p>
        </div>
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left border border-black/25 py-2 px-2 w-10">#</th>
              <th className="text-left border border-black/25 py-2 px-2">Product</th>
              <th className="text-right border border-black/25 py-2 px-2">Qty (kg)</th>
              <th className="text-right border border-black/25 py-2 px-2">Unit price</th>
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
                  {l.qtyKg}
                </td>
                <td className="border border-black/10 py-2 px-2 text-right tabular-nums align-top">
                  {moneyLabel(l.unitPricePerKg)}
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
            <span className="opacity-70">Subtotal (ex VAT)</span>
            <span className="tabular-nums">{moneyLabel(sale.netAmount)}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="opacity-70">VAT</span>
            <span className="tabular-nums">{moneyLabel(sale.vatAmount)}</span>
          </div>
          <div className="flex justify-between gap-8 border-t border-black/20 pt-2 font-semibold">
            <span>Grand total</span>
            <span className="tabular-nums">{moneyLabel(sale.grossAmount)}</span>
          </div>
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
                  <td className="py-2">{p.method}</td>
                  <td className="py-2">{formatDisplayDate(p.paidAtIso)}</td>
                  <td className="py-2 text-right tabular-nums">{moneyLabel(p.amount)}</td>
                  <td className="py-2 text-xs opacity-90">
                    {p.chequeNo ? `Chq: ${p.chequeNo}` : "—"}
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

