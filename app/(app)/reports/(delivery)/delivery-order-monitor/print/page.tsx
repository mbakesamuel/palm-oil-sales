import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { getServerSession } from "@/lib/auth-server";
import { fmtKgDom, loadDeliveryOrderMonitor, xafDom } from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function DeliveryOrderMonitorPrintPage(props: {
  searchParams: Promise<{ no?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { no: noRaw } = await props.searchParams;
  const result = await loadDeliveryOrderMonitor(session, noRaw);

  if ("type" in result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end print:hidden">
          <PrintButton label="Print" />
        </div>
        <ReportHeader title="Delivery order monitor" companyName="" />
        <p className="text-sm opacity-75">
          No sales point is assigned to your account; cannot print this report.
        </p>
        <ReportFooter signatory />
      </div>
    );
  }

  const {
    settings,
    scopedToSalesPoint,
    assignedSalesPointName,
    lookupNo,
    notFound,
    wrongScope,
    order,
    sales,
    doTotalAmount,
    doTotalQty,
    invoicedGross,
    invoicedNet,
    invoicedQtyKg,
    balanceAmount,
    productRows,
  } = result;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end print:hidden">
        <PrintButton label="Print" />
      </div>

      <ReportHeader
        companyName={settings.companyName}
        department={settings.department}
        logoSrc={settings.logoUrl}
        title="Delivery order monitor"
      />

      <p className="text-xs opacity-80">
        {scopedToSalesPoint ? (
          <>
            Sales point:{" "}
            <span className="font-medium">{assignedSalesPointName}</span>.
          </>
        ) : (
          <>Organization-wide.</>
        )}
      </p>

      {wrongScope ? (
        <p className="text-sm opacity-75">
          DO belongs to another sales point.
        </p>
      ) : null}

      {lookupNo && notFound ? (
        <p className="text-sm opacity-75">
          No delivery order found for{" "}
          <span className="font-mono font-medium">{lookupNo}</span>.
        </p>
      ) : null}

      {!order ? (
        <p className="text-sm opacity-75">
          Select a delivery order on the monitor screen before printing.
        </p>
      ) : (
        <>
          <section className="rounded-lg border border-border p-4 sm:p-6 space-y-3 print:break-inside-avoid">
            <h2 className="text-lg font-semibold">Delivery order</h2>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <div>
                <span className="opacity-70">DO no.</span>{" "}
                <span className="font-mono font-medium">
                  {order.deliveryOrderNo}
                </span>
              </div>
              <div>
                <span className="opacity-70">Date issued</span>{" "}
                <span className="tabular-nums">
                  {order.dateIssued.toISOString().slice(0, 10)}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="opacity-70">Customer</span>{" "}
                <span className="font-medium">{order.customer.name}</span>
                {order.customer.phone ? (
                  <span className="opacity-80 text-xs ml-2">
                    {order.customer.phone}
                  </span>
                ) : null}
              </div>
              <div>
                <span className="opacity-70">Collection point</span>{" "}
                <span className="font-medium">{order.salesPoint.name}</span>
              </div>
              <div>
                <span className="opacity-70">Status</span>{" "}
                <span className="font-medium">{order.status}</span>
              </div>
              {order.orderRef ? (
                <div className="sm:col-span-2">
                  <span className="opacity-70">Customer ref.</span>{" "}
                  {order.orderRef}
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-right">Qty</th>
                    <th className="px-3 py-2 font-medium">Unit</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Line (XAF)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.details.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-border odd:bg-foreground/4"
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium">
                          {d.product.productName}
                        </span>
                        <span className="text-xs opacity-70 ml-1 font-mono">
                          {d.product.productCode}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {d.orderQty}
                      </td>
                      <td className="px-3 py-2">{d.orderUnit ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {xafDom(d.amount ?? z)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-medium">
                    <td className="px-3 py-2">DO total</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {doTotalQty}
                    </td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right tabular-nums">
                      {xafDom(doTotalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-border p-4 sm:p-6 space-y-3 print:break-inside-avoid">
            <h2 className="text-lg font-semibold">Sales history (this DO no.)</h2>
            {sales.length === 0 ? (
              <p className="text-sm opacity-75">
                No sales invoices reference this delivery order yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-3 py-2 font-medium">Invoice</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      {!scopedToSalesPoint ? (
                        <th className="px-3 py-2 font-medium">Sales point</th>
                      ) : null}
                      <th className="px-3 py-2 font-medium">Clerk</th>
                      <th className="px-3 py-2 font-medium">
                        Lines (kg / product)
                      </th>
                      <th className="px-3 py-2 font-medium text-right">
                        Gross (XAF)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => {
                      const lineHint = s.lines
                        .map(
                          (l) =>
                            `${fmtKgDom(l.qtyKg)} ${l.product.productName}`,
                        )
                        .join(" · ");
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-border odd:bg-foreground/4 align-top"
                        >
                          <td className="px-3 py-2 font-mono text-xs font-medium">
                            {s.invoiceNo}
                          </td>
                          <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                            {s.dateIssued.toISOString().slice(0, 10)}
                          </td>
                          <td className="px-3 py-2">{s.status}</td>
                          {!scopedToSalesPoint ? (
                            <td className="px-3 py-2">
                              {s.salesPoint?.name ?? "—"}
                            </td>
                          ) : null}
                          <td className="px-3 py-2 text-xs">
                            {s.createdBy.name}
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {lineHint || "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {xafDom(s.grossAmount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border p-4 sm:p-6 space-y-3 print:break-inside-avoid">
            <h2 className="text-lg font-semibold">Summary</h2>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-right">DO qty</th>
                    <th className="px-3 py-2 font-medium">Unit</th>
                    <th className="px-3 py-2 font-medium text-right">
                      Invoiced (kg)
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      Qty balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((r) => (
                    <tr
                      key={r.productId}
                      className="border-b border-border odd:bg-foreground/4"
                    >
                      <td className="px-3 py-2">{r.productName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.doQty}
                      </td>
                      <td className="px-3 py-2">{r.orderUnit}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtKgDom(r.invoicedKg)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {fmtKgDom(r.qtyBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-medium">
                    <td className="px-3 py-2">Totals</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {doTotalQty}
                    </td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtKgDom(invoicedQtyKg)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtKgDom(new Prisma.Decimal(doTotalQty).sub(invoicedQtyKg))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 text-sm max-w-3xl">
              <div className="rounded-md border border-border px-3 py-2">
                <div className="text-xs opacity-70">DO total (XAF)</div>
                <div className="text-lg font-semibold tabular-nums">
                  {xafDom(doTotalAmount)}
                </div>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <div className="text-xs opacity-70">
                  Invoiced gross — validated (XAF)
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {xafDom(invoicedGross)}
                </div>
                <div className="text-[11px] opacity-60 mt-0.5">
                  Net {xafDom(invoicedNet)}
                </div>
              </div>
              <div className="rounded-md border border-border px-3 py-2">
                <div className="text-xs opacity-70">
                  Balance (DO − invoiced gross)
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {xafDom(balanceAmount)}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <ReportFooter signatory />
      <AutoPrint />
    </div>
  );
}
