import Link from "next/link";
import { redirect } from "next/navigation";
import { OpenReportButton } from "@/components/OpenReportButton";
import { ReportHeader } from "@/components/ReportHeader";
import { assertRouteAllowedForPath } from "@/lib/access-control";
import { getServerSession } from "@/lib/auth-server";
import { formatFinancialYearLabel } from "@/lib/fiscal";
import { ReportCrosstabSection } from "./ReportCrosstabSection";
import { loadBpoCrosstab } from "./loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BpoSalesCrosstabReportPage(props: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  await assertRouteAllowedForPath("/reports/bpo-sales-crosstab", session);

  const { fy: fyRaw } = await props.searchParams;
  const { periods, selectedPeriod, rows, settings } = await loadBpoCrosstab(fyRaw);

  if (!selectedPeriod) {
    return (
      <div className="space-y-6">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="BPO sales crosstab"
        />
        <p className="text-sm opacity-75">
          No financial year exists. Create a financial year before running this
          report.
        </p>
      </div>
    );
  }

  const generated = new Date();
  const fyLabel = formatFinancialYearLabel(
    selectedPeriod.financialYear,
    settings.fiscalYearStartMonth,
  );

  return (
    <div data-print-page="bpo-sales-crosstab" className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Monthly Bottled Palm Oil Sales Report
            </h1>
            <p className="text-sm opacity-80">
              Financial year <span className="font-medium">{fyLabel}</span>.
              Values are validated Bottled Palm Oil sales by variant.
            </p>
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
              href="/reports/bpo-sales-crosstab/print"
              params={{ fy: selectedPeriod.financialYear }}
              label="Print report"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {periods.map((period) => (
          <Link
            key={period.financialYear}
            href={`/reports/bpo-sales-crosstab?fy=${period.financialYear}`}
            className={[
              "rounded-md border px-2 py-1 tabular-nums",
              period.financialYear === selectedPeriod.financialYear
                ? "border-foreground/25 bg-accent/35"
                : "border-border hover:bg-accent/25",
            ].join(" ")}
          >
            {formatFinancialYearLabel(
              period.financialYear,
              settings.fiscalYearStartMonth,
            )}
          </Link>
        ))}
      </div>

      <ReportCrosstabSection
        title="Quantity units"
        unitLabel="Month and financial-year-to-date units sold."
        metric="units"
        rows={rows}
        financialYear={selectedPeriod.financialYear}
        fiscalYearStartMonth={settings.fiscalYearStartMonth}
      />

      <ReportCrosstabSection
        title="Gross sales amount"
        unitLabel="Month and financial-year-to-date gross sales in XAF."
        metric="gross"
        rows={rows}
        financialYear={selectedPeriod.financialYear}
        fiscalYearStartMonth={settings.fiscalYearStartMonth}
      />
    </div>
  );
}
