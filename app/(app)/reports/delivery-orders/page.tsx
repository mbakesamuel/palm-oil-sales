import Link from "next/link";
import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { PrintButton } from "@/components/PrintButton";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xaf(d: Prisma.Decimal) {
  const n = Number(d.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP));
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);
}

export default async function DeliveryOrdersReportPage() {
  const [settings, prisma] = await Promise.all([getOrInitCompanySettings(), getPrismaClient()]);

  const orders = await prisma.deliveryOrder.findMany({
    orderBy: { dateIssued: "desc" },
    take: 400,
    select: {
      id: true,
      deliveryOrderNo: true,
      dateIssued: true,
      orderRef: true,
      financialYear: true,
      financialMonth: true,
      customer: { select: { name: true } },
      salesPoint: { select: { name: true } },
      details: { select: { amount: true } },
    },
  });

  const rows = orders.map((o) => {
    const total = o.details.reduce(
      (acc, d) => acc.add(d.amount ?? new Prisma.Decimal(0)),
      new Prisma.Decimal(0),
    );
    return { ...o, lineCount: o.details.length, total };
  });

  const grand = rows.reduce((acc, r) => acc.add(r.total), new Prisma.Decimal(0));

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
        <div>
          <h1 className="text-2xl font-semibold">Report · Delivery orders</h1>
          <p className="text-sm opacity-80 mt-1">{settings.companyName}</p>
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated {generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
            {rows.length} row{rows.length === 1 ? "" : "s"} (latest 400)
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton label="Print report" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 text-left">
              <th className="px-3 py-2 font-medium">DO no.</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Sales point</th>
              <th className="px-3 py-2 font-medium text-right">Lines</th>
              <th className="px-3 py-2 font-medium text-right">Total (XAF)</th>
              <th className="px-3 py-2 font-medium">FY / Mo</th>
              <th className="px-3 py-2 font-medium print:hidden">Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-black/5 dark:border-white/5 odd:bg-black/2 dark:odd:bg-white/2"
              >
                <td className="px-3 py-2 font-mono text-xs font-medium">{r.deliveryOrderNo}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {r.dateIssued.toISOString().slice(0, 10)}
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate" title={r.customer.name}>
                  {r.customer.name}
                </td>
                <td className="px-3 py-2 max-w-[140px] truncate" title={r.salesPoint.name}>
                  {r.salesPoint.name}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.lineCount}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{xaf(r.total)}</td>
                <td className="px-3 py-2 tabular-nums text-xs opacity-80">
                  {r.financialYear != null && r.financialMonth != null
                    ? `${r.financialYear} / ${r.financialMonth}`
                    : "—"}
                </td>
                <td className="px-3 py-2 print:hidden">
                  <Link
                    href={`/delivery-orders/${r.id}`}
                    className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-black/15 dark:border-white/15 font-medium">
                <td className="px-3 py-2" colSpan={5}>
                  Grand total (this page)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{xaf(grand)}</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 print:hidden" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm opacity-75">No delivery orders yet.</p>
      ) : null}
    </div>
  );
}
