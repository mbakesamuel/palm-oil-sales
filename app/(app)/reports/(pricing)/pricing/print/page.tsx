import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { getServerSession } from "@/lib/auth-server";
import { AutoPrint } from "@/components/AutoPrint";
import { PrintButton } from "@/components/PrintButton";
import { ReportFooter } from "@/components/ReportFooter";
import { ReportHeader } from "@/components/ReportHeader";
import { PricingScheduleTable } from "@/components/PricingScheduleTable";
import {
  buildPricingGroups,
  pickLatestPricingRows,
  type PricingScheduleRow,
} from "@/lib/pricing-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PricingReportPrintPage(props: {
  searchParams: Promise<{ effectiveFrom?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { effectiveFrom } = await props.searchParams;
  const effectiveFromIso = (effectiveFrom ?? "").trim();

  const [openFy, settings] = await Promise.all([
    getOpenFinancialYearPeriod(),
    getOrInitCompanySettings(),
  ]);

  if (!openFy) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-end gap-2 print:hidden">
          <PrintButton label="Print" />
        </div>
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department ?? null}
          logoSrc={settings.logoUrl}
          title="Pricing report"
        />
        <p className="text-sm opacity-80 rounded-lg border border-border p-4">
          No financial year is open. Open a period under Financial years, then
          print again.
        </p>
        <ReportFooter signatory />
      </div>
    );
  }

  const prisma = getPrismaClient();
  const schedules = await prismaRetry(() =>
    prisma.productUnitPriceSchedule.findMany({
      where: {
        effectiveFrom: { gte: openFy.startDate, lte: openFy.endDate },
      },
      orderBy: [{ productId: "asc" }, { effectiveFrom: "desc" }],
      include: {
        product: { select: { productName: true, productCatId: true } },
      },
    }),
  );

  const rows: PricingScheduleRow[] = schedules.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.productName,
    productCatId: r.product.productCatId,
    customerType: r.customerType,
    effectiveFromIso: r.effectiveFrom.toISOString().slice(0, 10),
    unitPriceExTax: r.unitPriceExTax.toString(),
  }));

  const base =
    effectiveFromIso !== ""
      ? rows.filter((r) => r.effectiveFromIso === effectiveFromIso)
      : pickLatestPricingRows(rows);
  const groups = buildPricingGroups(base);
  const totalRows = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex items-center justify-end gap-2 print:hidden">
        <PrintButton label="Print" />
      </div>

      <ReportHeader
        companyName={settings.companyName}
        department={settings.department ?? null}
        logoSrc={settings.logoUrl}
        title="Pricing report"
      />

      <p className="text-xs opacity-75 tabular-nums">
        Financial year{" "}
        <span className="font-medium">{String(openFy.financialYear)}</span>{" "}
        ({openFy.startDate.toISOString().slice(0, 10)} to{" "}
        {openFy.endDate.toISOString().slice(0, 10)})
        {" · "}
        Effective from{" "}
        <span className="font-medium">
          {effectiveFromIso !== "" ? effectiveFromIso : "Latest"}
        </span>
        {" · "}
        {totalRows} row{totalRows === 1 ? "" : "s"} across {groups.length} product
        {groups.length === 1 ? "" : "s"}
      </p>

      <PricingScheduleTable groups={groups} />

      <ReportFooter signatory />
      <AutoPrint />
    </div>
  );
}
