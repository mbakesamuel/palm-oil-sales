import { redirect } from "next/navigation";
import { Prisma, ValidationStatus } from "@prisma/client";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { getServerSession } from "@/lib/auth-server";
import {
  describeFulfillment,
  fmtKgCdm,
  invoicedKgByProductFromSales,
  loadCustomerDeliveryMonitor,
  xafCdm,
} from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function CustomerDeliveryMonitorPrintPage(props: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { customerId: customerIdRaw } = await props.searchParams;
  const result = await loadCustomerDeliveryMonitor(session, customerIdRaw);

  if ("type" in result) {
    return (
      <div className="space-y-4 max-w-xl">
        <div className="flex items-center justify-end print:hidden">
          <PrintButton label="Print" />
        </div>
        <ReportHeader title="Delivery orders by customer" companyName="" />
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
    selectedCustomerId,
    customerRow,
    orders,
    salesByDoNo,
    summaryRows,
    grandDoAmount,
    grandInvoiced,
    grandBalance,
    grandDoQty,
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
        title="Delivery orders by customer"
      />

      {!selectedCustomerId || !customerRow ? (
        <p className="text-sm opacity-75">
          Pick a customer on the monitor screen before printing.
        </p>
      ) : (
        <>
          <p className="text-xs opacity-80">
            {scopedToSalesPoint ? (
              <>
                Sales point:{" "}
                <span className="font-medium">{assignedSalesPointName}</span>.{" "}
              </>
            ) : null}
            Customer: <span className="font-medium">{customerRow.name}</span>
            {customerRow.phone ? (
              <span className="opacity-70 ml-2">{customerRow.phone}</span>
            ) : null}
          </p>

          {orders.length === 0 ? (
            <p className="text-sm opacity-75">
              No delivery orders for this customer in scope.
            </p>
          ) : (
            <>
              <section className="space-y-2 print:break-inside-avoid">
                <h2 className="text-lg font-semibold">Summary</h2>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="px-3 py-2 font-medium">DO no.</th>
                        <th className="px-3 py-2 font-medium">Date</th>
                        {!scopedToSalesPoint ? (
                          <th className="px-3 py-2 font-medium">Sales point</th>
                        ) : null}
                        <th className="px-3 py-2 font-medium">Doc status</th>
                        <th className="px-3 py-2 font-medium">Fulfillment</th>
                        <th className="px-3 py-2 font-medium text-right">
                          DO qty
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          DO (XAF)
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          Sales
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          Invoiced
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-border odd:bg-foreground/4"
                        >
                          <td className="px-3 py-2 font-mono text-xs font-medium">
                            {r.deliveryOrderNo}
                          </td>
                          <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                            {r.dateIssued.toISOString().slice(0, 10)}
                          </td>
                          {!scopedToSalesPoint ? (
                            <td className="px-3 py-2">{r.salesPointName}</td>
                          ) : null}
                          <td className="px-3 py-2">{r.status}</td>
                          <td className="px-3 py-2 text-xs">
                            {r.fulfillmentLabel}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {r.doTotalQty}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {xafCdm(r.doTotalAmount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs">
                            {r.validatedSaleCount}/{r.saleCount} val.
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {xafCdm(r.invoicedGross)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {xafCdm(r.balanceAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border font-medium">
                        <td
                          className="px-3 py-2"
                          colSpan={scopedToSalesPoint ? 4 : 5}
                        >
                          Totals ({summaryRows.length} DO
                          {summaryRows.length === 1 ? "" : "s"})
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {grandDoQty}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {xafCdm(grandDoAmount)}
                        </td>
                        <td className="px-3 py-2" aria-hidden />
                        <td className="px-3 py-2 text-right tabular-nums">
                          {xafCdm(grandInvoiced)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {xafCdm(grandBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>

              <section className="space-y-6">
                <h2 className="text-lg font-semibold">
                  Detail by delivery order
                </h2>
                {orders.map((o) => {
                  const salesForDo = salesByDoNo.get(o.deliveryOrderNo) ?? [];
                  const validated = salesForDo.filter(
                    (s) => s.status === ValidationStatus.VALIDATED,
                  );
                  const invMap = invoicedKgByProductFromSales(validated);
                  const { label: fulLabel } = describeFulfillment(
                    o.status,
                    o.details,
                    invMap,
                  );
                  const doTotalAmount = o.details.reduce(
                    (acc, d) => acc.add(d.amount ?? z),
                    z,
                  );
                  const doTotalQty = o.details.reduce(
                    (acc, d) => acc + d.orderQty,
                    0,
                  );

                  return (
                    <div
                      key={o.id}
                      className="rounded-lg border border-border p-4 sm:p-5 space-y-3 print:break-inside-avoid"
                    >
                      <div>
                        <h3 className="text-base font-semibold font-mono">
                          {o.deliveryOrderNo}
                        </h3>
                        <p className="text-xs opacity-75 mt-1">
                          {o.dateIssued.toISOString().slice(0, 10)}
                          {!scopedToSalesPoint ? (
                            <span>
                              {" "}
                              ·{" "}
                              <span className="font-medium">
                                {o.salesPoint.name}
                              </span>
                            </span>
                          ) : null}
                          {" · "}
                          Doc <span className="font-medium">{o.status}</span>
                          {" · "}
                          Fulfillment:{" "}
                          <span className="font-medium">{fulLabel}</span>
                        </p>
                      </div>

                      <div className="overflow-x-auto rounded-md border border-border">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left">
                              <th className="px-3 py-2 font-medium">Product</th>
                              <th className="px-3 py-2 font-medium text-right">
                                Qty
                              </th>
                              <th className="px-3 py-2 font-medium">Unit</th>
                              <th className="px-3 py-2 font-medium text-right">
                                Invoiced (kg)
                              </th>
                              <th className="px-3 py-2 font-medium text-right">
                                Balance (kg)
                              </th>
                              <th className="px-3 py-2 font-medium text-right">
                                Line (XAF)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {o.details.map((d) => {
                              const inv = invMap.get(d.productId) ?? z;
                              const bal = new Prisma.Decimal(d.orderQty).sub(
                                inv,
                              );
                              return (
                                <tr
                                  key={d.id}
                                  className="border-b border-border odd:bg-foreground/4"
                                >
                                  <td className="px-3 py-2">
                                    {d.product.productName}{" "}
                                    <span className="text-xs font-mono opacity-70">
                                      {d.product.productCode}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {d.orderQty}
                                  </td>
                                  <td className="px-3 py-2">
                                    {d.orderUnit ?? "—"}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {fmtKgCdm(inv)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {fmtKgCdm(bal)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {xafCdm(d.amount ?? z)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-border font-medium">
                              <td className="px-3 py-2">Subtotal</td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {doTotalQty}
                              </td>
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2 text-right tabular-nums">
                                {xafCdm(doTotalAmount)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold mb-2">
                          Sales history
                        </h4>
                        {salesForDo.length === 0 ? (
                          <p className="text-sm opacity-75">
                            No linked sales in scope.
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-md border border-border">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="border-b border-border text-left">
                                  <th className="px-3 py-2 font-medium">
                                    Invoice
                                  </th>
                                  <th className="px-3 py-2 font-medium">
                                    Date
                                  </th>
                                  <th className="px-3 py-2 font-medium">
                                    Status
                                  </th>
                                  {!scopedToSalesPoint ? (
                                    <th className="px-3 py-2 font-medium">
                                      SP
                                    </th>
                                  ) : null}
                                  <th className="px-3 py-2 font-medium">
                                    Clerk
                                  </th>
                                  <th className="px-3 py-2 font-medium">
                                    Lines (kg)
                                  </th>
                                  <th className="px-3 py-2 font-medium text-right">
                                    Gross
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {salesForDo.map((s) => {
                                  const hint = s.lines
                                    .map(
                                      (l) =>
                                        `${fmtKgCdm(l.qtyKg)} ${l.product.productName}`,
                                    )
                                    .join(" · ");
                                  return (
                                    <tr
                                      key={s.id}
                                      className="border-b border-border odd:bg-foreground/4 align-top"
                                    >
                                      <td className="px-3 py-2 font-mono text-xs">
                                        {s.invoiceNo}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                                        {s.dateIssued
                                          .toISOString()
                                          .slice(0, 10)}
                                      </td>
                                      <td className="px-3 py-2">{s.status}</td>
                                      {!scopedToSalesPoint ? (
                                        <td className="px-3 py-2 text-xs">
                                          {s.salesPoint?.name ?? "—"}
                                        </td>
                                      ) : null}
                                      <td className="px-3 py-2 text-xs">
                                        {s.createdBy.name}
                                      </td>
                                      <td className="px-3 py-2 text-xs">
                                        {hint || "—"}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">
                                        {xafCdm(s.grossAmount)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            </>
          )}
        </>
      )}

      <ReportFooter signatory />
      <AutoPrint />
    </div>
  );
}
