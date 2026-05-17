import "server-only";

import type { CommercialService, PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { DEFAULTS } from "@/lib/env";

export const DEFAULT_COMMERCIAL_SERVICE_CODE = "default";

/**
 * Active commercial service for postings: user assignment, else the `default` code row.
 */
export async function resolveCommercialServiceForUserId(
  prisma: PrismaClient,
  userId: string | null | undefined,
): Promise<CommercialService> {
  if (userId) {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      include: { commercialService: true },
    });
    const cs = u?.commercialService;
    if (cs?.isActive) return cs;
    if (cs && !cs.isActive) {
      const fallback = await prisma.commercialService.findFirst({
        where: { code: DEFAULT_COMMERCIAL_SERVICE_CODE },
      });
      if (fallback) return fallback;
    }
  }
  const d = await prisma.commercialService.findFirst({
    where: { code: DEFAULT_COMMERCIAL_SERVICE_CODE },
    orderBy: { sortOrder: "asc" },
  });
  if (!d) {
    throw new Error(
      'No commercial service is configured. Under Setup, open "Commercial lines of business" and add a default service.',
    );
  }
  return d;
}

export async function getDefaultCommercialInvoicePrefix(): Promise<string> {
  const prisma = getPrismaClient();
  const cs = await prisma.commercialService.findFirst({
    where: { code: DEFAULT_COMMERCIAL_SERVICE_CODE },
    select: { invoicePrefix: true },
  });
  return cs?.invoicePrefix ?? DEFAULTS.invoicePrefix;
}
