import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  deleteTaxType,
  saveTaxRateSchedule,
  saveTaxType,
} from "./actions";
import { TaxTypesClient } from "./TaxTypesClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rateToPercent(rate: string): string {
  const n = Number.parseFloat(rate);
  if (!Number.isFinite(n)) return rate;
  return (n * 100).toFixed(2).replace(/\.?0+$/, "");
}

export default async function TaxTypesPage() {
  const prisma = getPrismaClient();
  const types = await prismaRetry(() =>
    prisma.taxType.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      include: {
        rateSchedules: {
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
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
        currentRatePercent:
          t.rateSchedules[0] != null
            ? rateToPercent(t.rateSchedules[0].rate.toString())
            : null,
      }))}
      saveTaxTypeAction={saveTaxType}
      deleteTaxTypeAction={deleteTaxType}
      saveTaxRateScheduleAction={saveTaxRateSchedule}
    />
  );
}
