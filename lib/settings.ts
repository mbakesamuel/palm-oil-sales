import "server-only";

import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { DEFAULTS, getVatRateDecimal } from "@/lib/env";

export async function getOrInitCompanySettings() {
  const prisma = getPrismaClient();
  const existing = await prisma.companySettings.findUnique({
    where: { id: "default" },
  });
  if (existing) return existing;

  try {
    return await prisma.companySettings.create({
      data: {
        id: "default",
        companyName: "Palm Oil Sales",
        vatRate: getVatRateDecimal(),
        invoicePrefix: DEFAULTS.invoicePrefix,
        fiscalYearStartMonth: 1,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prisma.companySettings.findUnique({
        where: { id: "default" },
      });
      if (row) return row;
    }
    throw e;
  }
}

