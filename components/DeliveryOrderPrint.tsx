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
  return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XAF`;
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
  subtotal: string;
};

export function DeliveryOrderPrint(props: {
  companyName: string;
  department: string | null;
  companyPhone: string | null;
  companyAddress: string | null;
  order: DeliveryOrderPrintModel;
}) {
  const { companyName, department, companyPhone, companyAddress, order } = props;

  return (
    <article className="delivery-order-print text-black bg-white max-w-3xl mx-auto print:max-w-none print:mx-0">
      <header className="border-b border-black/20 pb-4 mb-6">
        {department ? (
          <p className="text-xs font-semibold uppercase tracking-widest opacity-80">{department}</p>
        ) : null}
        <h1 className="text-xl font-bold mt-1">{companyName}</h1>
        <div className="mt-2 text-sm opacity-90 space-y-0.5">
          {companyAddress ? <p>{companyAddress}</p> : null}
          {companyPhone ? <p>Tel: {companyPhone}</p> : null}
        </div>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-wide">Delivery order</h2>
          <p className="text-sm mt-1">
            <span className="opacity-70">No.</span>{" "}
            <span className="font-semibold tabular-nums">{order.deliveryOrderNo}</span>
          </p>
          <p className="text-sm">
            <span className="opacity-70">Date issued</span>{" "}
            <span className="font-medium">{formatDisplayDate(order.dateIssuedIso)}</span>
          </p>
          {order.orderRef ? (
            <p className="text-sm">
              <span className="opacity-70">Your ref</span> <span>{order.orderRef}</span>
            </p>
          ) : null}
          {order.collectionPoint ? (
            <p className="text-sm">
              <span className="opacity-70">Collection</span> <span>{order.collectionPoint}</span>
            </p>
          ) : null}
        </div>

        <div className="rounded-lg border border-black/15 p-3 text-sm sm:min-w-[220px]">
          <p className="text-xs font-semibold uppercase opacity-70 mb-1">Deliver to</p>
          <p className="font-semibold">{order.customer.name}</p>
          {order.customer.taxpayerId ? (
            <p className="opacity-80">Tax ID: {order.customer.taxpayerId}</p>
          ) : null}
          {order.customer.phone ? <p className="opacity-80">{order.customer.phone}</p> : null}
          {order.customer.address ? (
            <p className="opacity-80 whitespace-pre-line mt-1">{order.customer.address}</p>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-black/25">
              <th className="text-left py-2 pr-2 w-10">#</th>
              <th className="text-left py-2 pr-2">Product</th>
              <th className="text-right py-2 pr-2">Qty</th>
              <th className="text-left py-2 pr-2 w-16">Unit</th>
              <th className="text-right py-2 pr-2">Unit price</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.details.map((row) => (
              <tr key={row.lineNo} className="border-b border-black/10">
                <td className="py-2 pr-2 tabular-nums opacity-80">{row.lineNo}</td>
                <td className="py-2 pr-2">
                  <span className="font-medium">{row.productName}</span>
                  {row.productCode ? (
                    <span className="block text-xs opacity-70">Code: {row.productCode}</span>
                  ) : null}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{row.orderQty}</td>
                <td className="py-2 pr-2">{row.orderUnit ?? "—"}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{moneyLabel(row.unitPrice)}</td>
                <td className="py-2 text-right tabular-nums font-medium">{moneyLabel(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8">
        <div className="text-sm space-y-1 min-w-[200px]">
          <div className="flex justify-between gap-8 border-t border-black/20 pt-2">
            <span className="opacity-70">Subtotal</span>
            <span className="font-semibold tabular-nums">{moneyLabel(order.subtotal)}</span>
          </div>
        </div>
      </div>

      {order.payments.length > 0 ? (
        <section className="mb-8">
          <h3 className="text-sm font-bold uppercase tracking-wide mb-2">Payments recorded</h3>
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
                  <td className="py-2">{formatDisplayDate(p.paymentDateIso)}</td>
                  <td className="py-2 text-xs opacity-90">
                    {[p.chequeNo ? `Chq: ${p.chequeNo}` : null, p.bank ? `Bank: ${p.bank}` : null, p.cashReceiptNo ? `Receipt: ${p.cashReceiptNo}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                    {p.receiptDateIso ? ` (receipt ${formatDisplayDate(p.receiptDateIso)})` : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className="mt-12 pt-8 border-t border-black/15 text-sm grid sm:grid-cols-2 gap-8 print:mt-16">
        <div>
          <p className="opacity-70 mb-8">Prepared by</p>
          <div className="border-b border-black/40 h-px w-full max-w-xs" />
        </div>
        <div>
          <p className="opacity-70 mb-8">Received by</p>
          <div className="border-b border-black/40 h-px w-full max-w-xs" />
        </div>
      </footer>
    </article>
  );
}
