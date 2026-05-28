import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { getServerSession } from "@/lib/auth-server";
import { formatFinancialYearLabel } from "@/lib/fiscal";
import { ReportCrosstabSection } from "../ReportCrosstabSection";
import { loadBpoCrosstab } from "../loader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bpoReportRoles = new Set<UserRole>([
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.SENIOR_SUPERVISOR,
  UserRole.CLERK_IN_CHARGE_BPO,
]);

export default async function BpoSalesCrosstabPrintPage(props: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!bpoReportRoles.has(session.role as UserRole)) redirect("/forbidden");

  const { fy: fyRaw } = await props.searchParams;
  const { selectedPeriod, rows, settings } = await loadBpoCrosstab(fyRaw);

  if (!selectedPeriod) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end print:hidden">
          <PrintButton label="Print" />
        </div>
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
        <ReportFooter signatory />
      </div>
    );
  }

  const fyLabel = formatFinancialYearLabel(
    selectedPeriod.financialYear,
    settings.fiscalYearStartMonth,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end print:hidden">
        <PrintButton label="Print" />
      </div>

      <ReportHeader
        companyName={settings.companyName}
        department={settings.department}
        logoSrc={settings.logoUrl}
        title="Monthly Bottled Palm Oil Sales Report"
      />

      <p className="text-xs opacity-80">
        Financial year <span className="font-medium">{fyLabel}</span>. Values
        are validated Bottled Palm Oil sales by variant.
      </p>

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

      <ReportFooter signatory />
      <AutoPrint />
    </div>
  );
}
