import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL missing");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: ["error"],
  });

  try {
    const sat = await prisma.taxType.findUnique({
      where: { code: "SAT" },
      select: { id: true, code: true, name: true },
    });
    console.log("SAT tax type:", sat);
    if (!sat) return;

    const rows = await prisma.taxRateSchedule.findMany({
      where: { taxTypeId: sat.id },
      orderBy: [{ variant: "asc" }, { effectiveFrom: "desc" }],
      select: { id: true, variant: true, effectiveFrom: true, rate: true },
    });
    console.log(
      "SAT schedules:",
      rows.map((r) => ({
        id: r.id,
        variant: r.variant,
        effectiveFrom: iso(r.effectiveFrom),
        rate: r.rate.toString(),
      })),
    );

    const checkDay = "2026-01-01";
    const asOf = new Date(`${checkDay}T00:00:00.000Z`);
    console.log(
      "Rows on/before 2026-01-01:",
      rows
        .filter((r) => r.effectiveFrom <= asOf)
        .map((r) => ({
          variant: r.variant,
          effectiveFrom: iso(r.effectiveFrom),
          rate: r.rate.toString(),
        })),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

