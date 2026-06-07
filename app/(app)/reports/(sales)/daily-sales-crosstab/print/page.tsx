import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { buildReportUrl } from "@/lib/build-report-url";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { ReportSignatory } from "@/components/ReportSignatory";
import { getServerSession } from "@/lib/auth-server";
import { getOrInitCompanySettings } from "@/lib/settings";
import { DailySalesCrosstabTable } from "../DailySalesCrosstabTable";
import { loadDailySalesCrosstab } from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DailySalesCrosstabPrintPage(props: {
  searchParams: Promise<{ salesPointId?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const searchParams = await props.searchParams;
  const [data, settings] = await Promise.all([
    loadDailySalesCrosstab(session, searchParams),
    getOrInitCompanySettings(),
  ]);

  const backHref = buildReportUrl("/reports/daily-sales-crosstab", {
    salesPointId: searchParams.salesPointId,
  });

  if ("type" in data) {
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
          title="Daily sales report"
        />
        <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          Your role is tied to a sales point, but none is assigned. Ask an
          administrator.
        </div>
        <ReportFooter signatory />
      </div>
    );
  }

  const subtitleParts = [
    data.selectedSalesPointName,
    data.monthFilter?.label,
    data.monthFilter ? `FY ${data.monthFilter.financialYear}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      <AutoPrint />
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
        title="Daily sales report"
      />
      {subtitleParts.length > 0 ? (
        <p className="text-center text-sm opacity-80 -mt-4 mb-2">
          {subtitleParts.join(" · ")}
        </p>
      ) : null}

      {data.salesPointInvalid ? (
        <p className="text-sm">Invalid sales point filter.</p>
      ) : data.selectedSalesPointId ? (
        <DailySalesCrosstabTable
          columns={data.columns}
          rows={data.rows}
          colTotals={data.colTotals}
          grandTotal={data.grandTotal}
          compact
        />
      ) : (
        <p className="text-sm">Select a sales point to print this report.</p>
      )}

      <ReportSignatory />
      <ReportFooter signatory />
    </div>
  );
}
