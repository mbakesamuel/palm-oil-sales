import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { getServerSession } from "@/lib/auth-server";
import { PricingReport } from "@/app/(app)/setup/product-pricing/PricingReport";
import { ReportSignatory } from "@/components/ReportSignatory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PricingReportPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const [openFy, settings] = await Promise.all([
    getOpenFinancialYearPeriod(),
    getOrInitCompanySettings(),
  ]);

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
          No financial year is open. Open a period under Financial years, then print again.
        </p>
        <div className="hidden print:block">
          <ReportSignatory />
        </div>
      </div>
    );
  }

  const prisma = getPrismaClient();
  const fyWhere = {
    effectiveFrom: { gte: openFy.startDate, lte: openFy.endDate },
  };

  const schedules = await prismaRetry(() =>
    prisma.productUnitPriceSchedule.findMany({
      where: fyWhere,
      orderBy: [{ productId: "asc" }, { effectiveFrom: "desc" }],
      include: { product: { select: { productName: true, productCatId: true, form: true } } },
    }),
  );

  const scheduleModels = schedules.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.product.productName,
    productCatId: r.product.productCatId,
    customerType: r.customerType,
    effectiveFromIso: r.effectiveFrom.toISOString().slice(0, 10),
    unitPriceExTax: r.unitPriceExTax.toString(),
  }));

  const looseAndOther = scheduleModels.filter((r) => {
    const p = schedules.find((s) => s.id === r.id)?.product;
    return p?.form !== "BOTTLED";
  });

  const bottled = scheduleModels.filter((r) => {
    const p = schedules.find((s) => s.id === r.id)?.product;
    return p?.form === "BOTTLED";
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold print:text-xl">Product pricing</h1>
        <p className="text-sm opacity-80 mt-1 print:hidden">
          Unit prices for the open financial year — loose/catalog and bottled products. FY{" "}
          {String(openFy.financialYear)} (
          {openFy.startDate.toISOString().slice(0, 10)}–{openFy.endDate.toISOString().slice(0, 10)}).
        </p>
      </div>

      <PricingReport
        companyName={settings.companyName}
        department={settings.department ?? null}
        logoUrl={settings.logoUrl}
        schedules={looseAndOther}
        variantSchedules={bottled.map((r) => ({
          id: r.id,
          variantLabel: r.productName,
          effectiveFromIso: r.effectiveFromIso,
          unitPriceExTax: r.unitPriceExTax,
        }))}
      />

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
