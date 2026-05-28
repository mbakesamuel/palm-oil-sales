import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { OpenReportButton } from "@/components/OpenReportButton";
import { getServerSession } from "@/lib/auth-server";
import { fmtKgDom, loadDeliveryOrderMonitor, xafDom } from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function DeliveryOrderMonitorPage(props: {
  searchParams: Promise<{ no?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { no: noRaw } = await props.searchParams;
  const result = await loadDeliveryOrderMonitor(session, noRaw);

  if ("type" in result) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Delivery order monitor</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
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

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Delivery order monitor</h1>
          <p className="text-sm opacity-80 mt-1">{settings.companyName}</p>
          {scopedToSalesPoint ? (
            <p className="text-sm mt-2 opacity-80">
              Scoped to{" "}
              <span className="font-medium">{assignedSalesPointName}</span> —
              only delivery orders and sales at this collection point are shown.
            </p>
          ) : (
            <p className="text-sm mt-2 opacity-80">
              Organization-wide — any delivery order number and all linked sales
              invoices.
            </p>
          )}
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div>
          <OpenReportButton
            href="/reports/delivery-order-monitor/print"
            params={{ no: lookupNo }}
            label="Print report"
            disabled={!order}
            title={!order ? "Look up a delivery order first" : undefined}
          />
        </div>
      </div>

      <form
        method="GET"
        className="flex flex-col sm:flex-row gap-2 sm:items-end max-w-2xl"
      >
        <div className="grid gap-1 flex-1">
          <label htmlFor="no" className="text-sm font-medium">
            Delivery order number
          </label>
          <input
            id="no"
            name="no"
            defaultValue={lookupNo}
            placeholder="e.g. DO-2026-000001"
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm font-mono"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-brand text-brand-foreground px-4 py-2 text-sm font-medium shrink-0"
        >
          Look up
        </button>
      </form>

      {wrongScope ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          This delivery order belongs to another sales point. You can only
          monitor orders for{" "}
          <span className="font-medium">{assignedSalesPointName}</span>.
        </div>
      ) : null}

      {lookupNo && notFound ? (
        <p className="text-sm opacity-75">
          No delivery order found for{" "}
          <span className="font-mono font-medium">{lookupNo}</span>.
        </p>
      ) : null}

      {order ? (
        <>
          <section className="rounded-lg border border-border p-4 sm:p-6 space-y-3">
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
              {order.financialYear != null &&
              order.postingCalendarYear != null &&
              order.financialMonth != null ? (
                <div className="sm:col-span-2 text-xs opacity-80 tabular-nums">
                  FY {order.financialYear} · {order.postingCalendarYear}-
                  {String(order.financialMonth).padStart(2, "0")}
                </div>
              ) : null}
              {order.createdBy ? (
                <div>
                  <span className="opacity-70">Created by</span>{" "}
                  {order.createdBy.name}
                </div>
              ) : null}
              {order.validatedBy ? (
                <div>
                  <span className="opacity-70">Validated by</span>{" "}
                  {order.validatedBy.name}
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

          <section className="rounded-lg border border-border p-4 sm:p-6 space-y-3">
            <h2 className="text-lg font-semibold">Sales history (this DO no.)</h2>
            {scopedToSalesPoint ? (
              <p className="text-xs opacity-75">
                Only invoices posted at your sales point are listed.
              </p>
            ) : null}
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
                      <th className="px-3 py-2 font-medium" />
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
                            <td
                              className="px-3 py-2 max-w-[120px] truncate"
                              title={s.salesPoint?.name ?? ""}
                            >
                              {s.salesPoint?.name ?? "—"}
                            </td>
                          ) : null}
                          <td className="px-3 py-2 text-xs">
                            {s.createdBy.name}
                          </td>
                          <td
                            className="px-3 py-2 text-xs max-w-[280px]"
                            title={lineHint}
                          >
                            {lineHint || "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {xafDom(s.grossAmount)}
                          </td>
                          <td className="px-3 py-2">
                            <Link
                              href={`/sales/${s.id}`}
                              className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border p-4 sm:p-6 space-y-3">
            <h2 className="text-lg font-semibold">Summary</h2>
            <p className="text-xs opacity-75 max-w-3xl">
              <span className="font-medium">Invoiced</span> uses only{" "}
              <span className="font-medium">VALIDATED</span> sales. Quantities
              on invoices are stored in{" "}
              <span className="font-medium">kg</span>; compare to the DO line
              qty when your document unit is also kg (or convert outside the
              app).
            </p>
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
      ) : null}
    </div>
  );
}
