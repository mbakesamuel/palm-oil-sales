import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { buildReportUrl } from "@/lib/build-report-url";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { getServerSession } from "@/lib/auth-server";
import { getOrInitCompanySettings } from "@/lib/settings";
import {
  fmtDate,
  fmtKg,
  formatDailySalesDateRangeLabel,
  loadDailySalesSummary,
} from "../loader";
import { ReportSignatory } from "@/components/ReportSignatory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const z = new Prisma.Decimal(0);

export default async function DailySalesSummaryPrintPage(props: {
  searchParams: Promise<{ date?: string; from?: string; to?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const [data, settings] = await Promise.all([
    loadDailySalesSummary(session, searchParams),
    getOrInitCompanySettings(),
  ]);

  if (data.scopedToSalesPoint && data.assignedSalesPointId == null) {
    const backHref = buildReportUrl("/reports/daily-sales-summary", {
      from: searchParams.from ?? searchParams.date,
      to: searchParams.to ?? searchParams.from ?? searchParams.date,
    });
    return (
      <div className="space-y-4 max-w-xl">
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
          >
            ← Back to report
          </Link>
          <PrintButton label="Print" />
        </div>
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department ?? null}
          logoSrc={settings.logoUrl}
          title="Daily sales summary"
        />
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but no sales point is assigned to
          your account. Ask an administrator to assign one before you can print
          this report.
        </div>
        <ReportFooter signatory />
      </div>
    );
  }

  const {
    monthFilter,
    dateFromIso,
    dateToIso,
    dateInvalid,
    rangeInvalid,
    rows,
    totalsByType,
    grandQty,
    doMetaByNo,
    customerTypeOptions,
    scopedToSalesPoint,
    assignedSalesPointName,
  } = data;

  const rangeLabel = formatDailySalesDateRangeLabel(dateFromIso, dateToIso);

  const backHref = buildReportUrl("/reports/daily-sales-summary", {
    from: dateFromIso ?? searchParams.from ?? searchParams.date,
    to: dateToIso ?? searchParams.to ?? searchParams.date,
  });

  return (
    <div className="space-y-4 w-full min-w-0 max-w-none">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          ← Back
        </Link>
        <PrintButton label="Print" />
      </div>

      <ReportHeader
        companyName={settings.companyName}
        department={settings.department ?? null}
        logoSrc={settings.logoUrl}
        title="Daily sales summary"
      />

      <div className="text-xs opacity-80 space-y-1">
        <p className="text-lg font-bold">
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
          ) : null}
          {rangeLabel ? (
            <>
              {" · "}Period <span className="font-medium">{rangeLabel}</span> (
              {rows.length} validated sale{rows.length === 1 ? "" : "s"})
            </>
          ) : null}
        </p>
      </div>

      {dateInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          The requested dates are outside the current working calendar month.
        </div>
      ) : null}

      {rangeInvalid ? (
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200 max-w-xl">
          The from date must be on or before the to date.
        </div>
      ) : null}

      <div className="w-full min-w-0 rounded-lg border border-border overflow-x-auto">
        <table className="w-full min-w-208 border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-2 py-1 font-medium">Customer</th>
              <th className="px-2 py-1 font-medium">DO no.</th>
              <th className="px-2 py-1 font-medium">DO issued</th>
              <th className="px-2 py-1 font-medium">Vehicle no.</th>
              <th className="px-2 py-1 font-medium">Sale issued</th>
              <th className="px-2 py-1 font-medium text-right">Qty (kg)</th>
              <th className="px-2 py-1 font-medium text-right">
                DO balance (kg)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const doNo = s.deliveryOrderNo?.trim() ?? "";
              const meta = doNo ? doMetaByNo.get(doNo) : undefined;
              return (
                <tr
                  key={s.id}
                  className="border-b border-border odd:bg-foreground/4"
                >
                  <td
                    className="px-2 py-1 max-w-56 truncate"
                    title={s.customerNameSnapshot}
                  >
                    {s.customerNameSnapshot}
                  </td>
                  <td className="px-2 py-1 font-mono text-xs whitespace-nowrap">
                    {doNo || "—"}
                  </td>
                  <td className="px-2 py-1 tabular-nums whitespace-nowrap">
                    {meta ? fmtDate(meta.dateIssued) : "—"}
                  </td>
                  <td className="px-2 py-1 font-mono text-xs whitespace-nowrap">
                    {s.vehicleNumber || "—"}
                  </td>
                  <td className="px-2 py-1 tabular-nums whitespace-nowrap">
                    {fmtDate(s.dateIssued)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {fmtKg(s.qtyKg)}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                    {meta ? fmtKg(meta.balanceKg) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && rangeLabel && !dateInvalid && !rangeInvalid ? (
        <p className="text-sm opacity-75">
          No validated sales for {rangeLabel} in this scope and working month.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-2 print:break-inside-avoid">
          <h2 className="text-sm font-semibold">SUMMARY</h2>
          <div className="w-full max-w-md rounded-lg border border-border overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-foreground/6">
                  <th className="px-3 py-2 font-medium">Customer type</th>
                  <th className="px-3 py-2 font-medium text-right">Qty (kg)</th>
                </tr>
              </thead>
              <tbody>
                {customerTypeOptions.map((opt) => {
                  const q = totalsByType.get(opt.id);
                  if (!q || q.equals(z)) return null;
                  return (
                    <tr key={opt.id} className="border-b border-border">
                      <td className="px-3 py-2">{opt.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtKg(q)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-medium border-t-2 border-border">
                  <td className="px-3 py-2">Grand total</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtKg(grandQty)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/*    <ReportFooter signatory /> */}
      <ReportSignatory />
      <AutoPrint closeOnFinish={false} />
    </div>
  );
}
