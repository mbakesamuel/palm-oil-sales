import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { getOrInitCompanySettings } from "@/lib/settings";
import { getServerSession } from "@/lib/auth-server";
import { ReportSignatory } from "@/components/ReportSignatory";
import { BpoPricingReportView } from "./BpoPricingReportView";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function BpoPricingReportPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const prisma = getPrismaClient();
  const [variants, prices, settings] = await Promise.all([
    prismaRetry(() =>
      prisma.productVariant.findMany({
        where: { product: { isBottledPalmOil: true } },
        orderBy: [{ product: { productName: "asc" } }, { name: "asc" }],
        include: { product: { select: { productName: true } } },
      }),
    ),
    prismaRetry(() =>
      prisma.productVariantPriceSchedule.findMany({
        where: { productVariant: { product: { isBottledPalmOil: true } } },
        orderBy: [{ productVariant: { name: "asc" } }, { effectiveFrom: "desc" }],
        include: {
          productVariant: {
            select: { name: true, product: { select: { productName: true } } },
          },
        },
      }),
    ),
    getOrInitCompanySettings(),
  ]);

  return (
    <>
      <BpoPricingReportView
        companyName={settings.companyName}
        department={settings.department ?? null}
        logoUrl={settings.logoUrl}
        variants={variants.map((v) => ({
          id: v.id,
          productName: v.product.productName,
          name: v.name,
          unitLabel: v.unitLabel,
          unitQuantity: v.unitQuantity?.toString() ?? null,
          isActive: v.isActive,
        }))}
        prices={prices.map((p) => ({
          id: p.id,
          variantLabel: `${p.productVariant.product.productName} - ${p.productVariant.name}`,
          effectiveFromIso: p.effectiveFrom.toISOString().slice(0, 10),
          unitPriceExTax: p.unitPriceExTax.toString(),
        }))}
      />
      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </>
  );
}
