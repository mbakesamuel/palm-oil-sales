import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { listCustomerTypeDefinitions } from "@/lib/customer-types/catalog";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { getServerSession } from "@/lib/auth-server";
import { OpenReportButton } from "@/components/OpenReportButton";
import { PricingReport } from "@/app/(app)/setup/product-pricing/PricingReport";
import type { PricingScheduleRow } from "@/lib/pricing-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PricingReportPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const [openFy, settings] = await Promise.all([
    getOpenFinancialYearPeriod(),
    getOrInitCompanySettings(),
  ]);

  void settings;

  if (!openFy) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Product pricing</h1>
          <p className="text-sm opacity-80 mt-1">
            Printable unit prices by product (scopes to the open financial year).
          </p>
        </div>
        <p className="text-sm opacity-80 rounded-lg border border-border p-4">
          No financial year is open. Open a period under Financial years, then
          print again.
        </p>
      </div>
    );
  }

  const prisma = getPrismaClient();
  const [schedules, customerTypeOptions] = await Promise.all([
    prismaRetry(() =>
      prisma.productUnitPriceSchedule.findMany({
        where: {
          effectiveFrom: { gte: openFy.startDate, lte: openFy.endDate },
        },
        orderBy: [{ productId: "asc" }, { effectiveFrom: "desc" }],
        include: {
          product: {
            select: { productName: true, productCatId: true },
          },
          customerTypeDefinition: { select: { id: true, code: true, name: true } },
        },
      }),
    ),
    listCustomerTypeDefinitions({ activeOnly: true }),
  ]);

  const scheduleModels: PricingScheduleRow[] = schedules.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.productName,
    productCatId: r.product.productCatId,
    customerTypeId: r.customerTypeId,
    customerTypeName: r.customerTypeDefinition?.name ?? null,
    effectiveFromIso: r.effectiveFrom.toISOString().slice(0, 10),
    unitPriceExTax: r.unitPriceExTax.toString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Product pricing</h1>
          <p className="text-sm opacity-80 mt-1">
            Unit prices for the open financial year, grouped by product. FY{" "}
            {String(openFy.financialYear)} (
            {openFy.startDate.toISOString().slice(0, 10)}–
            {openFy.endDate.toISOString().slice(0, 10)}).
          </p>
        </div>
        <OpenReportButton
          href="/reports/pricing/print"
          label="Print report"
          sameTab
        />
      </div>

      <PricingReport
        schedules={scheduleModels}
        customerTypeOptions={customerTypeOptions}
      />
    </div>
  );
}
