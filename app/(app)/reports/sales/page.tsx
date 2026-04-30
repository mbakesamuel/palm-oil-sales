import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { prismaRetry } from "@/lib/prisma-retry";
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

export default async function SalesReportPage() {
  const [settings, prisma] = await Promise.all([getOrInitCompanySettings(), getPrismaClient()]);

  const sales = await prismaRetry(() =>
    prisma.sale.findMany({
    orderBy: { soldAt: "desc" },
    take: 400,
    select: {
      invoiceNo: true,
      soldAt: true,
      customerNameSnapshot: true,
      netAmount: true,
      vatAmount: true,
      grossAmount: true,
      financialYear: true,
      financialMonth: true,
      postingCalendarYear: true,
      createdBy: { select: { name: true } },
    },
    }),
  );

  const totals = sales.reduce(
    (acc, s) => ({
      net: acc.net.add(s.netAmount),
      vat: acc.vat.add(s.vatAmount),
      gross: acc.gross.add(s.grossAmount),
    }),
    {
      net: new Prisma.Decimal(0),
      vat: new Prisma.Decimal(0),
      gross: new Prisma.Decimal(0),
    },
  );

  const generated = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
        <div>
          <h1 className="text-2xl font-semibold">Report · Sales register</h1>
          <p className="text-sm opacity-80 mt-1">{settings.companyName}</p>
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated {generated.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
            {sales.length} row{sales.length === 1 ? "" : "s"} (latest 400)
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
              <th className="px-3 py-2 font-medium">Invoice</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Customer</th>
              <th className="px-3 py-2 font-medium">Clerk</th>
              <th className="px-3 py-2 font-medium text-right">Net (XAF)</th>
              <th className="px-3 py-2 font-medium text-right">VAT</th>
              <th className="px-3 py-2 font-medium text-right">Gross</th>
              <th className="px-3 py-2 font-medium">FY / calendar</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr
                key={s.invoiceNo}
                className="border-b border-black/5 dark:border-white/5 odd:bg-black/2 dark:odd:bg-white/2"
              >
                <td className="px-3 py-2 font-mono text-xs">{s.invoiceNo}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {s.soldAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-3 py-2 max-w-[200px] truncate" title={s.customerNameSnapshot}>
                  {s.customerNameSnapshot}
                </td>
                <td className="px-3 py-2 max-w-[120px] truncate">{s.createdBy.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{xaf(s.netAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{xaf(s.vatAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{xaf(s.grossAmount)}</td>
                <td className="px-3 py-2 tabular-nums text-xs opacity-80">
                  {s.financialYear != null &&
                  s.postingCalendarYear != null &&
                  s.financialMonth != null
                    ? `${s.financialYear} · ${s.postingCalendarYear}-${String(s.financialMonth).padStart(2, "0")}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          {sales.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-black/15 dark:border-white/15 font-medium">
                <td className="px-3 py-2" colSpan={4}>
                  Totals (this page)
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{xaf(totals.net)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{xaf(totals.vat)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{xaf(totals.gross)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {sales.length === 0 ? (
        <p className="text-sm opacity-75">No sales recorded yet.</p>
      ) : null}
    </div>
  );
}
