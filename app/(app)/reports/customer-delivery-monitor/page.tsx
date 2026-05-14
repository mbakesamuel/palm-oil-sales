import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { prismaRetry } from "@/lib/prisma-retry";
import { PrintButton } from "@/components/PrintButton";
import { ReportHeader } from "@/components/ReportHeader";
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

const z = new Prisma.Decimal(0);

function invoicedKgByProductFromSales(
  validatedSales: Array<{
    lines: Array<{ productId: number; qtyKg: Prisma.Decimal }>;
  }>,
): Map<number, Prisma.Decimal> {
  const map = new Map<number, Prisma.Decimal>();
  for (const s of validatedSales) {
    for (const l of s.lines) {
      map.set(l.productId, (map.get(l.productId) ?? z).add(l.qtyKg));
    }
  }
  return map;
}

function describeFulfillment(
  doStatus: ValidationStatus,
  details: Array<{ productId: number; orderQty: number }>,
  invoicedKgByProduct: Map<number, Prisma.Decimal>,
): { label: string; kind: "pending" | "complete" | "partial" | "over" } {
  if (doStatus === ValidationStatus.PENDING) {
    return { label: "Pending validation", kind: "pending" };
  }
  let over = false;
  let partial = false;
  for (const d of details) {
    const inv = invoicedKgByProduct.get(d.productId) ?? z;
    const ordered = new Prisma.Decimal(d.orderQty);
    if (inv.gt(ordered)) over = true;
    else if (inv.lt(ordered)) partial = true;
  }
  if (over) return { label: "Over-invoiced (check quantities)", kind: "over" };
  if (partial)
    return { label: "Incomplete (partial invoicing)", kind: "partial" };
  return { label: "Complete", kind: "complete" };
}

export default async function CustomerDeliveryMonitorPage(props: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Delivery orders by customer</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
        <div className="hidden print:block">
          <ReportSignatory />
        </div>
      </div>
    );
  }

  const { customerId: customerIdRaw } = await props.searchParams;
  const requestedCustomerId = String(customerIdRaw ?? "").trim();

  const [settings, prisma] = await Promise.all([
    getOrInitCompanySettings(),
    getPrismaClient(),
  ]);

  const doScopeWhere =
    scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {};

  const customerIdsWithScopedOrders = await prismaRetry(() =>
    prisma.deliveryOrder.findMany({
      where: doScopeWhere,
      distinct: ["customerId"],
      select: { customerId: true },
    }),
  );
  const allowedCustomerIds = new Set(
    customerIdsWithScopedOrders.map((r) => r.customerId),
  );

  const customerOptions = scopedToSalesPoint
    ? await prismaRetry(() =>
        prisma.customer.findMany({
          where: { id: { in: [...allowedCustomerIds] } },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      )
    : await prismaRetry(() =>
        prisma.customer.findMany({
          orderBy: { name: "asc" },
          take: 500,
          select: { id: true, name: true },
        }),
      );

  let selectedCustomerId = "";
  let customerInvalid = false;
  if (requestedCustomerId) {
    if (scopedToSalesPoint) {
      if (allowedCustomerIds.has(requestedCustomerId)) {
        selectedCustomerId = requestedCustomerId;
      } else {
        customerInvalid = true;
      }
    } else {
      const exists = await prismaRetry(() =>
        prisma.customer.findUnique({
          where: { id: requestedCustomerId },
          select: { id: true },
        }),
      );
      if (exists) {
        selectedCustomerId = requestedCustomerId;
      } else {
        customerInvalid = true;
      }
    }
  }

  const customerRow =
    selectedCustomerId &&
    (await prismaRetry(() =>
      prisma.customer.findUnique({
        where: { id: selectedCustomerId },
        select: { id: true, name: true, phone: true },
      }),
    ));

  const orders =
    selectedCustomerId && customerRow
      ? await prismaRetry(() =>
          prisma.deliveryOrder.findMany({
            where: {
              customerId: selectedCustomerId,
              ...doScopeWhere,
            },
            orderBy: [{ dateIssued: "desc" }, { id: "desc" }],
            include: {
              salesPoint: { select: { id: true, name: true } },
              details: {
                orderBy: { id: "asc" },
                include: {
                  product: {
                    select: {
                      productId: true,
                      productName: true,
                      productCode: true,
                    },
                  },
                },
              },
            },
          }),
        )
      : [];

  const deliveryOrderNos = orders.map((o) => o.deliveryOrderNo);
  const allSales =
    deliveryOrderNos.length > 0
      ? await prismaRetry(() =>
          prisma.sale.findMany({
            where: {
              deliveryOrderNo: { in: deliveryOrderNos },
              ...(scopedToSalesPoint && assignedSalesPointId != null
                ? { salesPointId: assignedSalesPointId }
                : {}),
            },
            orderBy: [{ soldAt: "asc" }, { id: "asc" }],
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

  const salesByDoNo = new Map<string, typeof allSales>();
  for (const s of allSales) {
    const k = s.deliveryOrderNo ?? "";
    if (!k) continue;
    const arr = salesByDoNo.get(k) ?? [];
    arr.push(s);
    salesByDoNo.set(k, arr);
  }

  type OrderRow = {
    id: number;
    deliveryOrderNo: string;
    dateIssued: Date;
    salesPointName: string;
    status: ValidationStatus;
    doTotalQty: number;
    doTotalAmount: Prisma.Decimal;
    saleCount: number;
    validatedSaleCount: number;
    invoicedGross: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    fulfillmentLabel: string;
    fulfillmentKind: "pending" | "complete" | "partial" | "over";
  };

  const summaryRows: OrderRow[] = orders.map((o) => {
    const salesForDo = salesByDoNo.get(o.deliveryOrderNo) ?? [];
    const validated = salesForDo.filter(
      (s) => s.status === ValidationStatus.VALIDATED,
    );
    const invoicedGross = validated.reduce(
      (acc, s) => acc.add(s.grossAmount),
      z,
    );
    const doTotalAmount = o.details.reduce(
      (acc, d) => acc.add(d.amount ?? z),
      z,
    );
    const doTotalQty = o.details.reduce((acc, d) => acc + d.orderQty, 0);
    const invMap = invoicedKgByProductFromSales(validated);
    const { label, kind } = describeFulfillment(o.status, o.details, invMap);
    return {
      id: o.id,
      deliveryOrderNo: o.deliveryOrderNo,
      dateIssued: o.dateIssued,
      salesPointName: o.salesPoint.name,
      status: o.status,
      doTotalQty,
      doTotalAmount,
      saleCount: salesForDo.length,
      validatedSaleCount: validated.length,
      invoicedGross,
      balanceAmount: doTotalAmount.sub(invoicedGross),
      fulfillmentLabel: label,
      fulfillmentKind: kind,
    };
  });

  const grandDoAmount = summaryRows.reduce(
    (acc, r) => acc.add(r.doTotalAmount),
    z,
  );
  const grandInvoiced = summaryRows.reduce(
    (acc, r) => acc.add(r.invoicedGross),
    z,
  );
  const grandBalance = grandDoAmount.sub(grandInvoiced);
  const grandDoQty = summaryRows.reduce((acc, r) => acc + r.doTotalQty, 0);

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div className="space-y-3 print:block">
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
          <div className="print:hidden">
            <PrintButton label="Print" />
          </div>
        </div>
      </div>

      <form method="GET" className="max-w-2xl space-y-2 print:hidden">
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
          <section className="rounded-lg border border-border p-4 sm:p-5 space-y-1 print:break-inside-avoid">
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
              <section className="space-y-2 print:break-inside-avoid">
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
                        <th className="px-3 py-2 font-medium print:hidden">
                          {" "}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-border odd:bg-foreground/[0.04]"
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
                            {xaf(r.doTotalAmount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-xs">
                            {r.validatedSaleCount}/{r.saleCount} val.
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {xaf(r.invoicedGross)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {xaf(r.balanceAmount)}
                          </td>
                          <td className="px-3 py-2 print:hidden">
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
                          {xaf(grandDoAmount)}
                        </td>
                        <td className="px-3 py-2" aria-hidden />
                        <td className="px-3 py-2 text-right tabular-nums">
                          {xaf(grandInvoiced)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {xaf(grandBalance)}
                        </td>
                        <td className="px-3 py-2 print:hidden" aria-hidden />
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
                          className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100 print:hidden"
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
                                  className="border-b border-border odd:bg-foreground/[0.04]"
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
                                    {fmtKg(inv)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {fmtKg(bal)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {xaf(d.amount ?? z)}
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
                                {xaf(doTotalAmount)}
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
                                  <th className="px-3 py-2 font-medium print:hidden" />
                                </tr>
                              </thead>
                              <tbody>
                                {salesForDo.map((s) => {
                                  const hint = s.lines
                                    .map(
                                      (l) =>
                                        `${fmtKg(l.qtyKg)} ${l.product.productName}`,
                                    )
                                    .join(" · ");
                                  return (
                                    <tr
                                      key={s.id}
                                      className="border-b border-border odd:bg-foreground/[0.04] align-top"
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
                                        {xaf(s.grossAmount)}
                                      </td>
                                      <td className="px-3 py-2 print:hidden">
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

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
