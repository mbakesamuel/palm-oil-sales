import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
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

export default async function ProductPricingPrintPage(props: {
  searchParams: Promise<{ effectiveFrom?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { effectiveFrom } = await props.searchParams;
  const effectiveFromIso = (effectiveFrom ?? "").trim();

  const prisma = getPrismaClient();
  const [schedules, settings] = await Promise.all([
    prismaRetry(() =>
      prisma.productUnitPriceSchedule.findMany({
        orderBy: [{ productId: "asc" }, { effectiveFrom: "desc" }],
        include: {
          product: {
            select: { productName: true, productCatId: true },
          },
        },
      }),
    ),
    getOrInitCompanySettings(),
  ]);

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
        Effective from{" "}
        <span className="font-medium">
          {effectiveFromIso !== "" ? effectiveFromIso : "Latest"}
        </span>
        {" · "}
        {totalRows} row{totalRows === 1 ? "" : "s"} across {groups.length} product
        {groups.length === 1 ? "" : "s"}
      </p>

      <PricingScheduleTable groups={groups} />

      <ReportFooter />
      <AutoPrint />
    </div>
  );
}
