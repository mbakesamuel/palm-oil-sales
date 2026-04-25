import "server-only";

import { getPrismaClient } from "@/lib/prisma";

export async function ensureDefaultTaxRegimes() {
  const prisma = getPrismaClient();

  const [vatApplicable, vatExempt] = await Promise.all([
    prisma.taxRegime.upsert({
      where: { name: "VAT_APPLICABLE" },
      create: { name: "VAT_APPLICABLE", vatApplies: true },
      update: { vatApplies: true },
    }),
    prisma.taxRegime.upsert({
      where: { name: "VAT_EXEMPT" },
      create: { name: "VAT_EXEMPT", vatApplies: false },
      update: { vatApplies: false },
    }),
  ]);

  return { vatApplicable, vatExempt };
}

