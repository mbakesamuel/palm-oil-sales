import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { prismaRetry } from "@/lib/prisma-retry";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { Prisma } from "@prisma/client";
import { getServerSession } from "@/lib/auth-server";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { resolveReportWorkingMonthFilter } from "@/lib/report-working-month-filter";
import { saleWhereExcludingPosPlaceholderCustomers } from "@/lib/customers/operational-customer-scope";
import {
  commercialServiceErrorForOperations,
  mergeWhereWithServiceScope,
  resolveServiceScope,
} from "@/lib/service-scope";

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

function formatPaymentMethods(
  payments: { paymentMethod: { name: string } }[],
): string {
  if (payments.length === 0) return "—";
  return payments.map((p) => p.paymentMethod.name).join("; ");
}

function formatPaymentBanks(payments: { bank: string | null }[]): string {
  const parts = payments.map((p) => (p.bank ?? "").trim()).filter(Boolean);
  if (parts.length === 0) return "—";
  return [...new Set(parts)].join("; ");
}

export default async function SalesReportPrintPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const assignedSalesPointName = session.salesPoint?.name ?? null;
  const scope = resolveServiceScope(session);
  const scopedServiceErr = commercialServiceErrorForOperations(scope);

  const [settings, { monthFilter, hasOpenFy }] = await Promise.all([
    getOrInitCompanySettings(),
    resolveReportWorkingMonthFilter(),
  ]);

  if (scopedServiceErr || (scopedToSalesPoint && assignedSalesPointId == null)) {
    const message =
      scopedServiceErr ??
      "Your role is tied to a sales point, but no sales point is assigned to your account. Ask an administrator to assign one before you can print this report.";
    return (
      <div className="space-y-4 max-w-xl">
        <div className="flex items-center justify-end print:hidden">
          <PrintButton label="Print" />
        </div>
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department ?? null}
          logoSrc={settings.logoUrl}
          title="Sales register"
        />
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          {message}
        </div>
        <ReportFooter signatory />
      </div>
    );
  }

  const prisma = getPrismaClient();

  const where = saleWhereExcludingPosPlaceholderCustomers(
    mergeWhereWithServiceScope(
      {
        vehicleNumber: { not: "BPO-OUTBOUND" },
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
      },
      scope,
    ),
  );

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
          select: {
            bank: true,
            paymentMethod: { select: { name: true } },
          },
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

  return (
    <div className="space-y-4 w-full min-w-0 max-w-none">
      <div className="flex items-center justify-end print:hidden">
        <PrintButton label="Print" />
      </div>

      <ReportHeader
        companyName={settings.companyName}
        department={settings.department ?? null}
        logoSrc={settings.logoUrl}
        title="Sales register"
      />

      <div className="text-xs opacity-80 space-y-1">
        <p>
          {scopedToSalesPoint && assignedSalesPointName
            ? `Sales at ${assignedSalesPointName} only.`
            : "All collection points (consolidated)."}
        </p>
        <p>
          {monthFilter ? (
            <>
              <span className="font-medium">Working month</span>:{" "}
              {monthFilter.label} (FY {monthFilter.financialYear}).
            </>
          ) : hasOpenFy ? (
            <>No working calendar month applied; showing recent sales.</>
          ) : (
            <>No financial year is open; showing recent sales without a posting-month filter.</>
          )}
          {" · "}
          {rows.length} row{rows.length === 1 ? "" : "s"} (latest {REPORT_LIMIT}
          {scopedToSalesPoint ? ", this sales point" : ""})
        </p>
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
                  className="border-b border-border odd:bg-foreground/4"
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
        <p className="text-sm opacity-75">No sales in this scope.</p>
      ) : null}

      <ReportFooter signatory />
      <AutoPrint />
    </div>
  );
}
