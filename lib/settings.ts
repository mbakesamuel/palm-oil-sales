import "server-only";

import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { DEFAULTS, getVatRateDecimal } from "@/lib/env";
import { ensureTaxCatalogSynced } from "@/lib/tax/bootstrap";

/** Neon cold start / pooler blips can exceed a few quick retries. */
const SETTINGS_DB_RETRY = { retries: 5, baseDelayMs: 400 } as const;

export async function getOrInitCompanySettings() {
  const prisma = getPrismaClient();

  const existing = await prismaRetry(
    () =>
      prisma.companySettings.findUnique({
        where: { id: "default" },
      }),
    SETTINGS_DB_RETRY,
  );
  if (existing) {
    await ensureTaxCatalogSynced(existing);
    return existing;
  }

  try {
    const created = await prismaRetry(
      () =>
        prisma.companySettings.create({
        data: {
          id: "default",
          companyName: "Palm Oil Sales",
          vatRate: getVatRateDecimal(),
          invoicePrefix: DEFAULTS.invoicePrefix,
          fiscalYearStartMonth: 1,
        },
      }),
      SETTINGS_DB_RETRY,
    );
    await ensureTaxCatalogSynced(created);
    return created;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prismaRetry(
        () =>
          prisma.companySettings.findUnique({
            where: { id: "default" },
          }),
        SETTINGS_DB_RETRY,
      );
      if (row) {
        await ensureTaxCatalogSynced(row);
        return row;
      }
    }
    throw e;
  }
}

