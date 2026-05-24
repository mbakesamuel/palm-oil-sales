import * as React from "react";
import { ReportHeader } from "@/components/ReportHeader";

function formatDisplayDate(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

function moneyLabel(value: string | null | undefined) {
  if (value == null || value === "") return "—";
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} XAF`;
}

export type DeliveryOrderPrintModel = {
  deliveryOrderNo: string;
  dateIssuedIso: string;
  orderRef: string | null;
  collectionPoint: string | null;
  customer: {
    name: string;
    phone: string | null;
    address: string | null;
    taxpayerId: string | null;
  };
  details: Array<{
    lineNo: number;
    productName: string;
    productCode: string | null;
    orderQty: number;
    orderUnit: string | null;
    unitPrice: string | null;
    lineSubtotalExTax: string | null;
    vatAmount: string | null;
    otherTaxLabel: string | null;
    otherTaxAmount: string | null;
    amount: string | null;
  }>;
  payments: Array<{
    method: string;
    paymentDateIso: string;
    chequeNo: string | null;
    bank: string | null;
    cashReceiptNo: string | null;
    receiptDateIso: string | null;
  }>;
  subtotalExTax: string;
  totalVat: string;
  totalOtherTax: string;
  grandTotal: string;
};

export function DeliveryOrderPrint(props: {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  logoSrc?: string | null;
  order: DeliveryOrderPrintModel;
}) {
  const {
    companyName,
    department,
    companyPhone,
    companyAddress,
    logoSrc,
    order,
  } = props;

  return (
    <article className="delivery-order-print text-black bg-white max-w-3xl mx-auto print:max-w-none print:mx-0">
      <header className="border-b border-black/20 pb-4 mb-6">
        <ReportHeader
          companyName={companyName}
          department={department}
          logoSrc={logoSrc}
          title="Delivery order"
        />
        {companyAddress || companyPhone ? (
          <div className="mt-2 text-center text-sm opacity-90 space-y-0.5">
            {companyAddress ? <p>{companyAddress}</p> : null}
            {companyPhone ? <p>Tel: {companyPhone}</p> : null}
          </div>
        ) : null}
      </header>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-sm">
            <span className="opacity-70">No.</span>{" "}
            <span className="font-semibold tabular-nums">
              {order.deliveryOrderNo}
            </span>
          </p>
          <p className="text-sm">
            <span className="opacity-70">Date issued</span>{" "}
            <span className="font-medium">
              {formatDisplayDate(order.dateIssuedIso)}
            </span>
          </p>
          {order.orderRef ? (
            <p className="text-sm">
              <span className="opacity-70">Your ref</span>{" "}
              <span>{order.orderRef}</span>
            </p>
          ) : null}
          {order.collectionPoint ? (
            <p className="text-sm">
              <span className="opacity-70">Collection</span>{" "}
              <span>{order.collectionPoint}</span>
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-black/15 p-3 text-sm sm:min-w-[220px]">
          <p className="text-xs font-semibold uppercase opacity-70 mb-1">
            Deliver to
          </p>
          <p className="font-semibold">{order.customer.name}</p>
          {order.customer.taxpayerId ? (
            <p className="opacity-80">Tax ID: {order.customer.taxpayerId}</p>
          ) : null}
          {order.customer.phone ? (
            <p className="opacity-80">{order.customer.phone}</p>
          ) : null}
          {order.customer.address ? (
            <p className="opacity-80 whitespace-pre-line mt-1">
              {order.customer.address}
            </p>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse min-w-[640px]">
          <thead>
            <tr>
              <th className="text-left border border-black/25 py-2 px-2 w-10">
                #
              </th>
              <th className="text-left border border-black/25 py-2 px-2">
                Product
              </th>
              <th className="text-right border border-black/25 py-2 px-2">
                Qty
              </th>
              <th className="text-left border border-black/25 py-2 px-2 w-14">
                Unit
              </th>
              <th className="text-right border border-black/25 py-2 px-2">
                Unit (ex VAT)
              </th>
              <th className="text-right border border-black/25 py-2 px-2">
                Net
              </th>
            </tr>
          </thead>
          <tbody>
            {order.details.map((row) => (
              <tr key={row.lineNo}>
                <td className="border border-black/10 py-2 px-2 tabular-nums opacity-80 align-top">
                  {row.lineNo}
                </td>
                <td className="border border-black/10 py-2 px-2 align-top">
                  <span className="font-medium">{row.productName}</span>
                  {row.productCode ? (
                    <span className="block text-xs opacity-70">
                      Code: {row.productCode}
                    </span>
                  ) : null}
                </td>
                <td className="border border-black/10 py-2 px-2 text-right tabular-nums align-top">
                  {row.orderQty}
                </td>
                <td className="border border-black/10 py-2 px-2 align-top">
                  {row.orderUnit ?? "—"}
                </td>
                <td className="border border-black/10 py-2 px-2 text-right tabular-nums align-top">
                  {moneyLabel(row.unitPrice)}
                </td>
                <td className="border border-black/10 py-2 px-2 text-right tabular-nums align-top">
                  {moneyLabel(row.lineSubtotalExTax)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8 border border-black/20 p-2">
        <div className="text-sm space-y-1 min-w-[240px]">
          <div className="flex justify-between gap-8">
            <span className="opacity-70">Subtotal (ex VAT)</span>
            <span className="tabular-nums">
              {moneyLabel(order.subtotalExTax)}
            </span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="opacity-70">VAT</span>
            <span className="tabular-nums">{moneyLabel(order.totalVat)}</span>
          </div>
          <div className="flex justify-between gap-8">
            <span className="opacity-70">Sales Tax</span>
            <span className="tabular-nums">
              {moneyLabel(order.totalOtherTax)}
            </span>
          </div>
          <div className="flex justify-between gap-8 border-t border-black/20 pt-2 font-semibold">
            <span>Grand total</span>
            <span className="tabular-nums">{moneyLabel(order.grandTotal)}</span>
          </div>
        </div>
      </div>

      {order.payments.length > 0 ? (
        <section className="mb-8">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-2">
            Payments recorded
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/25">
                <th className="text-left py-2">Method</th>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {order.payments.map((p, i) => (
                <tr key={i} className="border-b border-black/10">
                  <td className="py-2">{p.method}</td>
                  <td className="py-2">
                    {formatDisplayDate(p.paymentDateIso)}
                  </td>
                  <td className="py-2 text-xs opacity-90">
                    {[
                      p.chequeNo ? `Chq: ${p.chequeNo}` : null,
                      p.bank ? `Bank: ${p.bank}` : null,
                      p.cashReceiptNo ? `Receipt: ${p.cashReceiptNo}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                    {p.receiptDateIso
                      ? ` (receipt ${formatDisplayDate(p.receiptDateIso)})`
                      : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className="mt-16 pt-10 border-black/15 text-sm flex justify-end print:mt-24">
        <div className="text-right">
          <p className="opacity-70 mb-8">Manager, Local Sales</p>
          {/* <div className="border-b border-black/40 h-px w-[260px]" /> */}
        </div>
      </footer>
    </article>
  );
}
