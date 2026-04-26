import { getPrismaClient } from "@/lib/prisma";
import { TaxRegimesClient } from "./TaxRegimesClient";
import { deleteTaxRegime, saveTaxRegime } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TaxRegimesPage() {
  const prisma = getPrismaClient();

  const regimes = await prisma.taxRegime.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      vatApplies: true,
      _count: { select: { customers: true, sales: true } },
    },
  });

  return (
    <TaxRegimesClient
      regimes={regimes.map((r) => ({
        id: r.id,
        name: r.name,
        vatApplies: r.vatApplies,
        customersCount: r._count.customers,
        salesCount: r._count.sales,
      }))}
      saveTaxRegimeAction={saveTaxRegime}
      deleteTaxRegimeAction={deleteTaxRegime}
    />
  );
}

