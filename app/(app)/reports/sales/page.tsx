import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { prismaRetry } from "@/lib/prisma-retry";
import { PrintButton } from "@/components/PrintButton";
import { ReportSignatory } from "@/components/ReportSignatory";
import { PaymentMethod, Prisma } from "@prisma/client";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { resolveReportWorkingMonthFilter } from "@/lib/report-working-month-filter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPORT_LIMIT = 400;
const z = new Prisma.Decimal(0);

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

function formatPaymentMethods(payments: { method: PaymentMethod }[]): string {
  if (payments.length === 0) return "—";
  return payments
    .map((p) => {
      if (p.method === PaymentMethod.CHEQUE) return "Cheque";
      if (p.method === PaymentMethod.CREDIT) return "Credit";
      if (p.method === PaymentMethod.TRAITE) return "Traite";
      return "Cash";
    })
    .join("; ");
}

function formatPaymentBanks(payments: { bank: string | null }[]): string {
  const parts = payments.map((p) => (p.bank ?? "").trim()).filter(Boolean);
  if (parts.length === 0) return "—";
  return [...new Set(parts)].join("; ");
}

export default async function SalesReportPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;

  if (scopedToSalesPoint && assignedSalesPointId == null) {
    return (
      <div className="space-y-4 max-w-xl px-3 sm:px-8 lg:px-12">
        <h1 className="text-2xl font-semibold">Report · Sales register</h1>
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but no sales point is assigned to
          your account. Ask an administrator to assign one before you can view
          this report.
        </div>
        <div className="hidden print:block">
          <ReportSignatory />
        </div>
      </div>
    );
  }

  const [{ monthFilter, hasOpenFy }, settings, prisma] = await Promise.all([
    resolveReportWorkingMonthFilter(),
    getOrInitCompanySettings(),
    getPrismaClient(),
  ]);

  const where: Prisma.SaleWhereInput = {
    ...(scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {}),
    ...(monthFilter
      ? {
          financialYear: monthFilter.financialYear,
          postingCalendarYear: monthFilter.postingCalendarYear,
          financialMonth: monthFilter.financialMonth,
        }
      : {}),
  };

  const sales = await prismaRetry(() =>
    prisma.sale.findMany({
      where,
      orderBy: { soldAt: "desc" },
      take: REPORT_LIMIT,
      select: {
        invoiceNo: true,
        soldAt: true,
        customerNameSnapshot: true,
        netAmount: true,
        vatAmount: true,
        grossAmount: true,
        lines: { select: { qtyKg: true } },
        payments: {
          orderBy: { id: "asc" },
          select: { method: true, bank: true },
        },
      },
    }),
  );

  const rows = sales.map((s) => ({
    ...s,
    qtyKgTotal: s.lines.reduce((acc, l) => acc.add(l.qtyKg), z),
    paymentMethodsLabel: formatPaymentMethods(s.payments),
    paymentBanksLabel: formatPaymentBanks(s.payments),
  }));

  const totals = rows.reduce(
    (acc, s) => ({
      net: acc.net.add(s.netAmount),
      vat: acc.vat.add(s.vatAmount),
      gross: acc.gross.add(s.grossAmount),
      qtyKg: acc.qtyKg.add(s.qtyKgTotal),
    }),
    {
      net: new Prisma.Decimal(0),
      vat: new Prisma.Decimal(0),
      gross: new Prisma.Decimal(0),
      qtyKg: new Prisma.Decimal(0),
    },
  );

  const generated = new Date();

  return (
    <div className="space-y-6 w-full min-w-0 max-w-none px-1 py-2 sm:px-2 sm:py-4 lg:px-3 lg:py-6 print:px-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:block">
        <div>
          <h1 className="text-2xl font-semibold">Sales register</h1>
          <p className="text-sm opacity-80 mt-1">{settings.companyName}</p>
          <p className="text-sm opacity-75 mt-1">
            {scopedToSalesPoint && assignedSalesPointName
              ? `Sales at ${assignedSalesPointName} only.`
              : "All collection points (consolidated)."}
          </p>
          <p className="text-sm opacity-75 mt-1">
            {monthFilter ? (
              <>
                <span className="font-medium">Working month</span>:{" "}
                {monthFilter.label} (FY {monthFilter.financialYear}). Lists
                invoices whose posting calendar month matches the banner working
                month (change it under Financial years if needed).
              </>
            ) : hasOpenFy ? (
              <>
                No working calendar month could be applied; open year has no
                selectable months in range. Showing recent sales without a
                posting month filter.
              </>
            ) : (
              <>
                No financial year is open. Showing recent sales without a
                posting month filter. Open a year under Financial years to align
                this report with your working month.
              </>
            )}
          </p>
          <p className="text-xs opacity-70 mt-1 tabular-nums">
            Generated{" "}
            {generated.toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            · {rows.length} row{rows.length === 1 ? "" : "s"} (latest{" "}
            {REPORT_LIMIT}
            {scopedToSalesPoint ? ", this sales point" : ""})
          </p>
        </div>
        <div className="print:hidden">
          <PrintButton label="Print report" />
        </div>
      </div>

      <div className="w-full min-w-0 rounded-lg border border-border overflow-hidden">
        <table className="w-full min-w-0 table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[20%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-2 py-2 font-medium">Invoice</th>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Customer</th>
              <th className="px-2 py-2 font-medium">Payment</th>
              <th className="px-2 py-2 font-medium">Bank</th>
              <th className="px-2 py-2 font-medium text-right">Net (XAF)</th>
              <th className="px-2 py-2 font-medium text-right">VAT</th>
              <th className="px-2 py-2 font-medium text-right">Gross</th>
              <th className="px-2 py-2 font-medium text-right">Qty (kg)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const dateStr = s.soldAt
                .toISOString()
                .slice(0, 16)
                .replace("T", " ");
              return (
                <tr
                  key={s.invoiceNo}
                  className="border-b border-border odd:bg-foreground/[0.04]"
                >
                  <td
                    className="px-2 py-2 font-mono text-xs truncate max-w-0"
                    title={s.invoiceNo}
                  >
                    {s.invoiceNo}
                  </td>
                  <td
                    className="px-2 py-2 tabular-nums truncate max-w-0"
                    title={dateStr}
                  >
                    {dateStr}
                  </td>
                  <td
                    className="px-2 py-2 truncate max-w-0"
                    title={s.customerNameSnapshot}
                  >
                    {s.customerNameSnapshot}
                  </td>
                  <td
                    className="px-2 py-2 truncate max-w-0"
                    title={s.paymentMethodsLabel}
                  >
                    {s.paymentMethodsLabel}
                  </td>
                  <td
                    className="px-2 py-2 truncate max-w-0"
                    title={s.paymentBanksLabel}
                  >
                    {s.paymentBanksLabel}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    {xaf(s.netAmount)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    {xaf(s.vatAmount)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                    {xaf(s.grossAmount)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                    {fmtKg(s.qtyKgTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t-2 border-border font-medium">
                <td className="px-2 py-2 truncate max-w-0" colSpan={5}>
                  Totals (this page)
                </td>
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                  {xaf(totals.net)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                  {xaf(totals.vat)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                  {xaf(totals.gross)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">
                  {fmtKg(totals.qtyKg)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm opacity-75">
          No sales in this scope for the selected working month (or no posting
          month filter is applied).
        </p>
      ) : null}

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
