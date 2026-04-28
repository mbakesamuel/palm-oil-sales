import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { DEFAULTS, getVatRateDecimal } from "@/lib/env";

export async function getOrInitCompanySettings() {
  const prisma = getPrismaClient();
  return prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "Palm Oil Sales",
      vatRate: getVatRateDecimal(),
      invoicePrefix: DEFAULTS.invoicePrefix,
      fiscalYearStartMonth: 1,
    },
  });
}

