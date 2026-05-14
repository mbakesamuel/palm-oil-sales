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

const REPORT_LIMIT = 500;

function xaf(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

type SummaryRow = {
  salesPointId: number;
  salesPointName: string;
  orderCount: number;
  lineCount: number;
  total: Prisma.Decimal;
};

function buildSummaryBySalesPoint(
  rows: Array<{
    salesPoint: { id: number; name: string };
    lineCount: number;
    total: Prisma.Decimal;
  }>,
): SummaryRow[] {
  const map = new Map<number, SummaryRow>();
  for (const r of rows) {
    const id = r.salesPoint.id;
    const existing = map.get(id);
    if (existing) {
      existing.orderCount += 1;
      existing.lineCount += r.lineCount;
      existing.total = existing.total.add(r.total);
    } else {
      map.set(id, {
        salesPointId: id,
        salesPointName: r.salesPoint.name,
        orderCount: 1,
        lineCount: r.lineCount,
        total: r.total,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.salesPointName.localeCompare(b.salesPointName, undefined, { sensitivity: "base" }),
  );
}

export default async function DeliveryOrdersReportPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">Report · Delivery orders</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but no sales point is assigned to your account. Ask an
          administrator to assign one before you can view this report.
        </div>
        <div className="hidden print:block">
          <ReportSignatory />
        </div>
      </div>
    );
  }

  const [settings, prisma] = await Promise.all([getOrInitCompanySettings(), getPrismaClient()]);

  /** Clerks and supervisors only see manager-validated DOs at their sales point. */
  const where =
    scopedToSalesPoint && assignedSalesPointId != null
      ? {
          salesPointId: assignedSalesPointId,
          status: ValidationStatus.VALIDATED,
        }
      : undefined;

  const orders = await prismaRetry(() =>
    prisma.deliveryOrder.findMany({
      where,
      orderBy: { dateIssued: "desc" },
      take: REPORT_LIMIT,
      select: {
        id: true,
        deliveryOrderNo: true,
        dateIssued: true,
        orderRef: true,
        financialYear: true,
        financialMonth: true,
        postingCalendarYear: true,
        customer: { select: { name: true } },
        salesPoint: { select: { id: true, name: true } },
        details: { select: { amount: true } },
      },
    }),
  );

  const rows = orders.map((o) => {
    const total = o.details.reduce(
      (acc, d) => acc.add(d.amount ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );
    return { ...o, lineCount: o.details.length, total };
  });

  const grand = rows.reduce((acc, r) => acc.add(r.total), new Prisma.Decimal(0));
  const totalLines = rows.reduce((acc, r) => acc + r.lineCount, 0);
  const summaryBySp = !scopedToSalesPoint ? buildSummaryBySalesPoint(rows) : [];
  const summaryGrandOrders = summaryBySp.reduce((acc, s) => acc + s.orderCount, 0);
  const summaryGrandLines = summaryBySp.reduce((acc, s) => acc + s.lineCount, 0);
  const summaryGrandTotal = summaryBySp.reduce((acc, s) => acc.add(s.total), new Prisma.Decimal(0));

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
        <div>
          <h1 className="text-2xl font-semibold">Report · Delivery orders</h1>
          <p className="text-sm opacity-80 mt-1">{settings.companyName}</p>
          {scopedToSalesPoint ? (
            <div className="mt-2 space-y-1 text-sm text-black/80 dark:text-white/80">
              <p className="font-medium">
                Sales point: <span className="tabular-nums">{assignedSalesPointName}</span>
              </p>
              <p className="opacity-80 font-normal">
                Showing <span className="font-medium">validated</span> delivery orders only (pending
                orders are hidden until a manager validates them).
              </p>
            </div>
          ) : (
            <p className="text-sm mt-2 opacity-80">
              Organization-wide report — all sales points with summary totals.
            </p>
          )}
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
            {rows.length} order{rows.length === 1 ? "" : "s"}
            {rows.length >= REPORT_LIMIT ? ` (latest ${REPORT_LIMIT})` : ""}
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton label="Print report" />
        </div>
      </div>

      {!scopedToSalesPoint && summaryBySp.length > 0 ? (
        <section className="space-y-2 print:break-inside-avoid">
          <h2 className="text-lg font-semibold">Summary by sales point</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 font-medium">Sales point</th>
                  <th className="px-3 py-2 font-medium text-right">Orders</th>
                  <th className="px-3 py-2 font-medium text-right">Lines</th>
                  <th className="px-3 py-2 font-medium text-right">Total (XAF)</th>
                </tr>
              </thead>
              <tbody>
                {summaryBySp.map((s) => (
                  <tr
                    key={s.salesPointId}
                    className="border-b border-border odd:bg-foreground/[0.04]"
                  >
                    <td className="px-3 py-2 font-medium">{s.salesPointName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.orderCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.lineCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{xaf(s.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-medium">
                  <td className="px-3 py-2">Overall</td>
                  <td className="px-3 py-2 text-right tabular-nums">{summaryGrandOrders}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{summaryGrandLines}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{xaf(summaryGrandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold print:text-base">
          {scopedToSalesPoint
            ? "Validated orders for your sales point"
            : "Detail · all orders in scope"}
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-2 font-medium">DO no.</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                {!scopedToSalesPoint ? (
                  <th className="px-3 py-2 font-medium">Sales point</th>
                ) : null}
                <th className="px-3 py-2 font-medium text-right">Lines</th>
                <th className="px-3 py-2 font-medium text-right">Total (XAF)</th>
                <th className="px-3 py-2 font-medium">FY / calendar</th>
                <th className="px-3 py-2 font-medium print:hidden">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border odd:bg-foreground/[0.04]"
                >
                  <td className="px-3 py-2 font-mono text-xs font-medium">{r.deliveryOrderNo}</td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                    {r.dateIssued.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 max-w-[200px] truncate" title={r.customer.name}>
                    {r.customer.name}
                  </td>
                  {!scopedToSalesPoint ? (
                    <td className="px-3 py-2 max-w-[140px] truncate" title={r.salesPoint.name}>
                      {r.salesPoint.name}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right tabular-nums">{r.lineCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{xaf(r.total)}</td>
                  <td className="px-3 py-2 tabular-nums text-xs opacity-80">
                    {r.financialYear != null &&
                    r.postingCalendarYear != null &&
                    r.financialMonth != null
                      ? `${r.financialYear} · ${r.postingCalendarYear}-${String(r.financialMonth).padStart(2, "0")}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 print:hidden">
                    <Link
                      href={`/delivery-orders/${r.id}`}
                      className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                    >
                      View / print
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-border font-medium">
                  <td className="px-3 py-2" colSpan={scopedToSalesPoint ? 3 : 4}>
                    {scopedToSalesPoint
                      ? "Total (validated, this sales point)"
                      : "Grand total (this list)"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{totalLines}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{xaf(grand)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 print:hidden" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      {rows.length === 0 ? (
        <p className="text-sm opacity-75">
          {scopedToSalesPoint
            ? "No validated delivery orders for your sales point yet. Pending orders appear here after a manager validates them."
            : "No delivery orders yet."}
        </p>
      ) : null}

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
