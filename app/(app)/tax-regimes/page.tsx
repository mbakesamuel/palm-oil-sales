import { getPrismaClient } from "@/lib/prisma";
import { TaxRegimesClient } from "./TaxRegimesClient";
import { deleteTaxRegime, saveTaxRegime } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TaxRegimesPage() {
  const prisma = getPrismaClient();

  const [regimes, taxTypes] = await Promise.all([
    prisma.taxRegime.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        kind: true,
        vatApplies: true,
        taxTypeLinks: {
          select: { taxTypeId: true, taxType: { select: { code: true } } },
        },
        _count: { select: { customers: true, sales: true } },
      },
    }),
    prisma.taxType.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <TaxRegimesClient
      taxTypes={taxTypes}
      regimes={regimes.map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        vatApplies: r.vatApplies,
        taxTypeIds: r.taxTypeLinks.map((l) => l.taxTypeId),
        taxCodes: r.taxTypeLinks.map((l) => l.taxType.code),
        customersCount: r._count.customers,
        salesCount: r._count.sales,
      }))}
      saveTaxRegimeAction={saveTaxRegime}
      deleteTaxRegimeAction={deleteTaxRegime}
    />
  );
}

