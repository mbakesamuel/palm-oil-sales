import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, ValidationStatus } from "@prisma/client";
import { OpenReportButton } from "@/components/OpenReportButton";
import { ReportHeader } from "@/components/ReportHeader";
import { getServerSession } from "@/lib/auth-server";
import {
  describeFulfillment,
  fmtKgCdm,
  invoicedKgByProductFromSales,
  loadCustomerDeliveryMonitor,
  xafCdm,
} from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function CustomerDeliveryMonitorPage(props: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { customerId: customerIdRaw } = await props.searchParams;
  const result = await loadCustomerDeliveryMonitor(session, customerIdRaw);

  if ("type" in result) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Delivery orders by customer</h1>
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
    customerOptions,
    selectedCustomerId,
    customerInvalid,
    customerRow,
    orders,
    salesByDoNo,
    summaryRows,
    grandDoAmount,
    grandInvoiced,
    grandBalance,
    grandDoQty,
  } = result;

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="Delivery orders by customer"
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {scopedToSalesPoint ? (
              <p className="text-sm opacity-80">
                <span className="font-medium">Clerk / supervisor view</span> —
                only delivery orders and sales at{" "}
                <span className="font-medium">{assignedSalesPointName}</span>.
              </p>
            ) : (
              <p className="text-sm opacity-80">
                <span className="font-medium">
                  Senior supervisor / manager (and org-wide roles)
                </span>{" "}
                — all collection points for the selected customer.
              </p>
            )}
            <p className="mt-1 text-xs tabular-nums opacity-70">
              Generated{" "}
              {generated.toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
          </div>
          <div>
            <OpenReportButton
              href="/reports/customer-delivery-monitor/print"
              params={{ customerId: selectedCustomerId }}
              label="Print report"
              disabled={!selectedCustomerId}
              title={!selectedCustomerId ? "Pick a customer first" : undefined}
            />
          </div>
        </div>
      </div>

      <form method="GET" className="max-w-2xl space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="grid min-w-0 flex-1 gap-1">
            <label htmlFor="customerId" className="text-sm font-medium">
              Customer
            </label>
            <select
              id="customerId"
              name="customerId"
              defaultValue={selectedCustomerId}
              className="h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm"
              required
            >
              <option value="" disabled>
                Select customer
              </option>
              {customerOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-md bg-brand text-brand-foreground px-4 text-sm font-medium sm:w-auto w-full"
          >
            Run report
          </button>
        </div>
        {!scopedToSalesPoint ? (
          <p className="text-xs opacity-70">
            Any customer (up to 500 by name). Delivery orders and sales follow
            org-wide scope.
          </p>
        ) : (
          <p className="text-xs opacity-70">
            Only customers with delivery orders at your sales point appear here.
          </p>
        )}
      </form>

      {customerInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          {scopedToSalesPoint
            ? "That customer has no delivery orders at your sales point, or the selection is invalid."
            : "Unknown customer."}
        </div>
      ) : null}

      {selectedCustomerId && customerRow ? (
        <>
          <section className="rounded-lg border border-border p-4 sm:p-5 space-y-1">
            <h2 className="text-lg font-semibold">Customer</h2>
            <p className="text-sm">
              <span className="font-medium">{customerRow.name}</span>
              {customerRow.phone ? (
                <span className="opacity-80 text-sm ml-2">
                  {customerRow.phone}
                </span>
              ) : null}
            </p>
          </section>

          {orders.length === 0 ? (
            <p className="text-sm opacity-75">
              No delivery orders for this customer in scope.
            </p>
          ) : (
            <>
              <section className="space-y-2">
                <h2 className="text-lg font-semibold">Summary</h2>
                <p className="text-xs opacity-75 max-w-3xl">
                  <span className="font-medium">Fulfillment</span> compares
                  validated invoice line quantities (kg) to DO line quantities.{" "}
                  <span className="font-medium">Invoiced</span> amounts use only{" "}
                  <span className="font-medium">VALIDATED</span> sales.{" "}
                  <span className="font-medium">Balance</span> is DO line total
                  (XAF) minus validated gross.
                </p>
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
                        <th className="px-3 py-2 font-medium"> </th>
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
                            <td
                              className="px-3 py-2 max-w-[120px] truncate"
                              title={r.salesPointName}
                            >
                              {r.salesPointName}
                            </td>
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
                          <td className="px-3 py-2">
                            <Link
                              href={`/reports/delivery-order-monitor?no=${encodeURIComponent(r.deliveryOrderNo)}`}
                              className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                            >
                              DO monitor
                            </Link>
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
                        <td className="px-3 py-2" aria-hidden />
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
                      className="rounded-lg border border-border p-4 sm:p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
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
                        <Link
                          href={`/reports/delivery-order-monitor?no=${encodeURIComponent(o.deliveryOrderNo)}`}
                          className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                        >
                          Open in DO monitor
                        </Link>
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
                                  <th className="px-3 py-2 font-medium" />
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
                                        <td className="px-3 py-2 text-xs max-w-[100px] truncate">
                                          {s.salesPoint?.name ?? "—"}
                                        </td>
                                      ) : null}
                                      <td className="px-3 py-2 text-xs">
                                        {s.createdBy.name}
                                      </td>
                                      <td
                                        className="px-3 py-2 text-xs max-w-[240px]"
                                        title={hint}
                                      >
                                        {hint || "—"}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">
                                        {xafCdm(s.grossAmount)}
                                      </td>
                                      <td className="px-3 py-2">
                                        <Link
                                          href={`/sales/${s.id}`}
                                          className="text-xs underline underline-offset-2"
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
                      </div>
                    </div>
                  );
                })}
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
