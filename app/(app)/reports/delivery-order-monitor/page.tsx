import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { prismaRetry } from "@/lib/prisma-retry";
import { PrintButton } from "@/components/PrintButton";
import { ReportSignatory } from "@/components/ReportSignatory";
import { Prisma, ValidationStatus } from "@prisma/client";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xaf(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtKg(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(n);
}

export default async function DeliveryOrderMonitorPage(props: {
  searchParams: Promise<{ no?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Delivery order monitor</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an administrator.
        </div>
        <ReportSignatory />
      </div>
    );
  }

  const { no: noRaw } = await props.searchParams;
  const lookupNo = String(noRaw ?? "").trim();

  const [settings, prisma] = await Promise.all([getOrInitCompanySettings(), getPrismaClient()]);

  let notFound = false;
  let wrongScope = false;
  let order: Awaited<ReturnType<typeof loadOrder>> = null;

  async function loadOrder(deliveryOrderNo: string) {
    return prismaRetry(() =>
      prisma.deliveryOrder.findUnique({
        where: { deliveryOrderNo },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          salesPoint: { select: { id: true, name: true } },
          createdBy: { select: { name: true } },
          validatedBy: { select: { name: true } },
          details: {
            orderBy: { id: "asc" },
            include: {
              product: { select: { productId: true, productName: true, productCode: true } },
            },
          },
        },
      }),
    );
  }

  if (lookupNo) {
    order = await loadOrder(lookupNo);
    if (!order) {
      notFound = true;
    } else if (scopedToSalesPoint && order.salesPointId !== assignedSalesPointId) {
      wrongScope = true;
      order = null;
    }
  }

  const sales =
    lookupNo && order && !wrongScope
      ? await prismaRetry(() =>
          prisma.sale.findMany({
            where: {
              deliveryOrderNo: order.deliveryOrderNo,
              ...(scopedToSalesPoint && assignedSalesPointId != null
                ? { salesPointId: assignedSalesPointId }
                : {}),
            },
            orderBy: { soldAt: "asc" },
            include: {
              salesPoint: { select: { name: true } },
              lines: {
                orderBy: { id: "asc" },
                include: { product: { select: { productName: true } } },
              },
              createdBy: { select: { name: true } },
            },
          }),
        )
      : [];

  const z = new Prisma.Decimal(0);
  const doTotalAmount = order
    ? order.details.reduce((acc, d) => acc.add(d.amount ?? z), z)
    : z;

  const doTotalQty = order ? order.details.reduce((acc, d) => acc + d.orderQty, 0) : 0;

  const validatedSales = sales.filter((s) => s.status === ValidationStatus.VALIDATED);
  const invoicedGross = validatedSales.reduce((acc, s) => acc.add(s.grossAmount), z);
  const invoicedNet = validatedSales.reduce((acc, s) => acc.add(s.netAmount), z);
  const invoicedQtyKg = validatedSales.reduce(
    (acc, s) => acc.add(s.lines.reduce((a, l) => a.add(l.qtyKg), z)),
    z,
  );

  const balanceAmount = doTotalAmount.sub(invoicedGross);

  const invoicedKgByProduct = new Map<number, Prisma.Decimal>();
  for (const s of validatedSales) {
    for (const l of s.lines) {
      const prev = invoicedKgByProduct.get(l.productId) ?? z;
      invoicedKgByProduct.set(l.productId, prev.add(l.qtyKg));
    }
  }

  const productRows =
    order?.details.map((d) => {
      const inv = invoicedKgByProduct.get(d.productId) ?? z;
      const balQty = new Prisma.Decimal(d.orderQty).sub(inv);
      return {
        productId: d.productId,
        productName: d.product.productName,
        productCode: d.product.productCode,
        doQty: d.orderQty,
        orderUnit: d.orderUnit ?? "—",
        invoicedKg: inv,
        qtyBalance: balQty,
      };
    }) ?? [];

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
        <div>
          <h1 className="text-2xl font-semibold">Delivery order monitor</h1>
          <p className="text-sm opacity-80 mt-1">{settings.companyName}</p>
          {scopedToSalesPoint ? (
            <p className="text-sm mt-2 opacity-80">
              Scoped to <span className="font-medium">{assignedSalesPointName}</span> — only delivery
              orders and sales at this collection point are shown.
            </p>
          ) : (
            <p className="text-sm mt-2 opacity-80">
              Organization-wide — any delivery order number and all linked sales invoices.
            </p>
          )}
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton label="Print" />
        </div>
      </div>

      <form
        method="GET"
        className="flex flex-col sm:flex-row gap-2 sm:items-end max-w-2xl print:hidden"
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
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-mono"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium shrink-0"
        >
          Look up
        </button>
      </form>

      {wrongScope ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          This delivery order belongs to another sales point. You can only monitor orders for{" "}
          <span className="font-medium">{assignedSalesPointName}</span>.
        </div>
      ) : null}

      {lookupNo && notFound ? (
        <p className="text-sm opacity-75">
          No delivery order found for <span className="font-mono font-medium">{lookupNo}</span>.
        </p>
      ) : null}

      {order ? (
        <>
          <section className="rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-6 space-y-3 print:break-inside-avoid">
            <h2 className="text-lg font-semibold">Delivery order</h2>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <div>
                <span className="opacity-70">DO no.</span>{" "}
                <span className="font-mono font-medium">{order.deliveryOrderNo}</span>
              </div>
              <div>
                <span className="opacity-70">Date issued</span>{" "}
                <span className="tabular-nums">{order.dateIssued.toISOString().slice(0, 10)}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="opacity-70">Customer</span>{" "}
                <span className="font-medium">{order.customer.name}</span>
                {order.customer.phone ? (
                  <span className="opacity-80 text-xs ml-2">{order.customer.phone}</span>
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
                  <span className="opacity-70">Customer ref.</span> {order.orderRef}
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
                  <span className="opacity-70">Created by</span> {order.createdBy.name}
                </div>
              ) : null}
              {order.validatedBy ? (
                <div>
                  <span className="opacity-70">Validated by</span> {order.validatedBy.name}
                </div>
              ) : null}
            </div>

            <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/10">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-left">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-right">Qty</th>
                    <th className="px-3 py-2 font-medium">Unit</th>
                    <th className="px-3 py-2 font-medium text-right">Line (XAF)</th>
                  </tr>
                </thead>
                <tbody>
                  {order.details.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-black/5 dark:border-white/5 odd:bg-black/2 dark:odd:bg-white/2"
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium">{d.product.productName}</span>
                        <span className="text-xs opacity-70 ml-1 font-mono">{d.product.productCode}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.orderQty}</td>
                      <td className="px-3 py-2">{d.orderUnit ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {xaf(d.amount ?? z)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-black/15 dark:border-white/15 font-medium">
                    <td className="px-3 py-2">DO total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{doTotalQty}</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right tabular-nums">{xaf(doTotalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-6 space-y-3 print:break-inside-avoid">
            <h2 className="text-lg font-semibold">Sales history (this DO no.)</h2>
            {scopedToSalesPoint ? (
              <p className="text-xs opacity-75">
                Only invoices posted at your sales point are listed.
              </p>
            ) : null}
            {sales.length === 0 ? (
              <p className="text-sm opacity-75">No sales invoices reference this delivery order yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/10">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10 text-left">
                      <th className="px-3 py-2 font-medium">Invoice</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      {!scopedToSalesPoint ? (
                        <th className="px-3 py-2 font-medium">Sales point</th>
                      ) : null}
                      <th className="px-3 py-2 font-medium">Clerk</th>
                      <th className="px-3 py-2 font-medium">Lines (kg / product)</th>
                      <th className="px-3 py-2 font-medium text-right">Gross (XAF)</th>
                      <th className="px-3 py-2 font-medium print:hidden" />
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => {
                      const lineHint = s.lines
                        .map((l) => `${fmtKg(l.qtyKg)} ${l.product.productName}`)
                        .join(" · ");
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-black/5 dark:border-white/5 odd:bg-black/2 dark:odd:bg-white/2 align-top"
                        >
                          <td className="px-3 py-2 font-mono text-xs font-medium">{s.invoiceNo}</td>
                          <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                            {s.dateIssued.toISOString().slice(0, 10)}
                          </td>
                          <td className="px-3 py-2">{s.status}</td>
                          {!scopedToSalesPoint ? (
                            <td className="px-3 py-2 max-w-[120px] truncate" title={s.salesPoint?.name ?? ""}>
                              {s.salesPoint?.name ?? "—"}
                            </td>
                          ) : null}
                          <td className="px-3 py-2 text-xs">{s.createdBy.name}</td>
                          <td className="px-3 py-2 text-xs max-w-[280px]" title={lineHint}>
                            {lineHint || "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{xaf(s.grossAmount)}</td>
                          <td className="px-3 py-2 print:hidden">
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

          <section className="rounded-lg border border-black/10 dark:border-white/10 p-4 sm:p-6 space-y-3 print:break-inside-avoid">
            <h2 className="text-lg font-semibold">Summary</h2>
            <p className="text-xs opacity-75 max-w-3xl">
              <span className="font-medium">Invoiced</span> uses only <span className="font-medium">VALIDATED</span>{" "}
              sales. Quantities on invoices are stored in{" "}
              <span className="font-medium">kg</span>; compare to the DO line qty when your document unit is
              also kg (or convert outside the app).
            </p>
            <div className="overflow-x-auto rounded-md border border-black/10 dark:border-white/10">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10 dark:border-white/10 text-left">
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium text-right">DO qty</th>
                    <th className="px-3 py-2 font-medium">Unit</th>
                    <th className="px-3 py-2 font-medium text-right">Invoiced (kg)</th>
                    <th className="px-3 py-2 font-medium text-right">Qty balance</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((r) => (
                    <tr
                      key={r.productId}
                      className="border-b border-black/5 dark:border-white/5 odd:bg-black/2 dark:odd:bg-white/2"
                    >
                      <td className="px-3 py-2">{r.productName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.doQty}</td>
                      <td className="px-3 py-2">{r.orderUnit}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtKg(r.invoicedKg)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {fmtKg(r.qtyBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black/15 dark:border-white/15 font-medium">
                    <td className="px-3 py-2">Totals</td>
                    <td className="px-3 py-2 text-right tabular-nums">{doTotalQty}</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right tabular-nums">{fmtKg(invoicedQtyKg)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtKg(new Prisma.Decimal(doTotalQty).sub(invoicedQtyKg))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 text-sm max-w-3xl">
              <div className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
                <div className="text-xs opacity-70">DO total (XAF)</div>
                <div className="text-lg font-semibold tabular-nums">{xaf(doTotalAmount)}</div>
              </div>
              <div className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
                <div className="text-xs opacity-70">Invoiced gross — validated (XAF)</div>
                <div className="text-lg font-semibold tabular-nums">{xaf(invoicedGross)}</div>
                <div className="text-[11px] opacity-60 mt-0.5">Net {xaf(invoicedNet)}</div>
              </div>
              <div className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
                <div className="text-xs opacity-70">Balance (DO − invoiced gross)</div>
                <div className="text-lg font-semibold tabular-nums">{xaf(balanceAmount)}</div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <ReportSignatory />
    </div>
  );
}
