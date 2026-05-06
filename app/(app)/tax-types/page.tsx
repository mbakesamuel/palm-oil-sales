import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  deleteTaxRateSchedule,
  deleteTaxType,
  saveTaxRateSchedule,
  saveTaxType,
} from "./actions";
import { TaxTypesClient } from "./TaxTypesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TaxTypesPage() {
  const prisma = getPrismaClient();
  const types = await prismaRetry(() =>
    prisma.taxType.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      include: {
        rateSchedules: { orderBy: { effectiveFrom: "desc" } },
      },
    }),
  );

  return (
    <TaxTypesClient
      types={types.map((t) => ({
        id: t.id,
        code: t.code,
        name: t.name,
        sortOrder: t.sortOrder,
        rateSchedules: t.rateSchedules.map((r) => ({
          id: r.id,
          rate: r.rate.toString(),
          effectiveFromIso: r.effectiveFrom.toISOString().slice(0, 10),
          variant: r.variant,
        })),
      }))}
      saveTaxTypeAction={saveTaxType}
      deleteTaxTypeAction={deleteTaxType}
      saveTaxRateScheduleAction={saveTaxRateSchedule}
      deleteTaxRateScheduleAction={deleteTaxRateSchedule}
    />
  );
}
