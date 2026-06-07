import "server-only";

import { DEFAULT_COMMERCIAL_SERVICE_CODE } from "@/lib/commercial-service";
import { defaultModulesForSiteKind } from "@/lib/commercial-modules";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { DEFAULTS, getVatRateDecimal } from "@/lib/env";
import { ensureTaxCatalogSynced } from "@/lib/tax/bootstrap";
import { CommercialSiteKind } from "@prisma/client";

/** Neon cold start / pooler blips can exceed a few quick retries. */
const SETTINGS_DB_RETRY = { retries: 5, baseDelayMs: 400 } as const;

async function repairLegacyCommercialServiceCode() {
  const prisma = getPrismaClient();
  const [legacy, canonical] = await Promise.all([
    prisma.commercialService.findUnique({
      where: { code: "palm-oil-sales" },
      select: { id: true },
    }),
    prisma.commercialService.findUnique({
      where: { code: DEFAULT_COMMERCIAL_SERVICE_CODE },
      select: { id: true },
    }),
  ]);
  if (legacy && !canonical) {
    await prisma.commercialService.update({
      where: { id: legacy.id },
      data: { code: DEFAULT_COMMERCIAL_SERVICE_CODE },
    });
  }
}

async function ensureMinimalCommercialService() {
  const prisma = getPrismaClient();
  await repairLegacyCommercialServiceCode();

  const count = await prisma.commercialService.count();
  if (count > 0) return;

  await prisma.commercialService.create({
    data: {
      code: DEFAULT_COMMERCIAL_SERVICE_CODE,
      name: "Palm Oil Sales",
      invoicePrefix: DEFAULTS.invoicePrefix,
      siteKind: CommercialSiteKind.SALES_POINT,
      enabledModules: defaultModulesForSiteKind(CommercialSiteKind.SALES_POINT),
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

