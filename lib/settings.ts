import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { DEFAULTS, getVatRateDecimal } from "@/lib/env";
import { ensureTaxCatalogSynced } from "@/lib/tax/bootstrap";

/** Neon cold start / pooler blips can exceed a few quick retries. */
const SETTINGS_DB_RETRY = { retries: 5, baseDelayMs: 400 } as const;

async function ensureMinimalCommercialService() {
  const prisma = getPrismaClient();
  const count = await prisma.commercialService.count();
  if (count > 0) return;  //there is a record in the commercialservice table

  const row = await prisma.companySettings.findUnique({ where: { id: "default" } });

  await prisma.commercialService.create({
    data: {
      code: "palm-oil-sales",
    /*   name: row?.companyName?.trim() ? row.companyName.trim() : "Palm Oil Sales", */
      name: "Palm Oil Sales",
      invoicePrefix: DEFAULTS.invoicePrefix,
    },
  });
}

export async function getOrInitCompanySettings() {
  const prisma = getPrismaClient();

  /** Single-row upsert avoids parallel find→create races (and Prisma error noise from P2002). */
  const row = await prismaRetry(
    () =>
      prisma.companySettings.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          companyName: "Cameroon Development Corporation",
          vatRate: getVatRateDecimal(),
          fiscalYearStartMonth: 1,
        },
        update: {},
      }),
    SETTINGS_DB_RETRY,
  );

  await ensureTaxCatalogSynced(row);
  await ensureMinimalCommercialService();
  return row;
}

