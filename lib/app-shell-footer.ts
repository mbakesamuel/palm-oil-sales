import "server-only";

import type { AuthSession } from "@/lib/auth-session";
import {
  DEFAULT_COMMERCIAL_SERVICE_CODE,
  getDefaultCommercialInvoicePrefix,
} from "@/lib/commercial-service";
import { getPrismaClient } from "@/lib/prisma";

export type AppShellFooterContext = {
  department: string | null;
  serviceName: string | null;
  invoicePrefix: string;
  vatPct: string;
};

export async function resolveAppShellFooterContext(
  session: AuthSession,
  companySettings: { department: string | null; vatRate: { toString(): string } | string | number },
): Promise<AppShellFooterContext> {
  const vatPct = (
    Number.parseFloat(String(companySettings.vatRate)) * 100
  ).toFixed(2);

  const assigned = session.commercialService;
  if (assigned?.name?.trim()) {
    const prefix =
      assigned.invoicePrefix?.trim() || (await getDefaultCommercialInvoicePrefix());
    return {
      department: companySettings.department?.trim() || null,
      serviceName: assigned.name.trim(),
      invoicePrefix: prefix,
      vatPct,
    };
  }

  const prisma = getPrismaClient();
  const defaultLine = await prisma.commercialService.findFirst({
    where: { code: DEFAULT_COMMERCIAL_SERVICE_CODE, isActive: true },
    select: { name: true, invoicePrefix: true },
    orderBy: { sortOrder: "asc" },
  });

  return {
    department: companySettings.department?.trim() || null,
    serviceName: defaultLine?.name?.trim() ?? null,
    invoicePrefix:
      defaultLine?.invoicePrefix?.trim() ?? (await getDefaultCommercialInvoicePrefix()),
    vatPct,
  };
}

export function formatAppShellFooterLine(ctx: AppShellFooterContext): string {
  return [
    ctx.department,
    ctx.serviceName,
    "Currency: XAF",
    `VAT: ${ctx.vatPct}%`,
    `Invoice prefix: ${ctx.invoicePrefix}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function formatAppShellSidebarSubtitle(ctx: AppShellFooterContext): string {
  return `Currency: XAF · VAT: ${ctx.vatPct}% · Invoice prefix: ${ctx.invoicePrefix}`;
}
