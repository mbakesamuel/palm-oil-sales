import "server-only";

import { ValidationStatus } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { getPrismaClient } from "@/lib/prisma";
import { prismaRetry } from "@/lib/prisma-retry";
import { profileFromCommercialService } from "@/lib/commercial-profile";
import {
  canAccessExecutiveDashboard,
  canAccessLineDashboard,
  normalizeServiceCodeParam,
} from "@/lib/dashboard-routing";
import { resolveReportWorkingMonthFilter } from "@/lib/report-working-month-filter";

export type ExecutiveDashboardSummary = {
  monthFilter: Awaited<
    ReturnType<typeof resolveReportWorkingMonthFilter>
  >["monthFilter"];
  lines: Array<{
    code: string;
    name: string;
    siteKind: string;
    saleCount: number;
    pendingDoCount: number;
    pendingSaleCount: number;
  }>;
};

export async function getExecutiveDashboardSummary(
  _session: AuthSession,
): Promise<ExecutiveDashboardSummary> {
  const prisma = getPrismaClient();
  const { monthFilter } = await resolveReportWorkingMonthFilter();

  const services = await prismaRetry(() =>
    prisma.commercialService.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        siteKind: true,
        enabledModules: true,
      },
    }),
  );

  const monthWhere = monthFilter
    ? {
        financialYear: monthFilter.financialYear,
        postingCalendarYear: monthFilter.postingCalendarYear,
        financialMonth: monthFilter.financialMonth,
      }
    : {};

  const lines = await Promise.all(
    services.map(async (service) => {
      const [saleCount, pendingDoCount, pendingSaleCount] = await Promise.all([
        prismaRetry(() =>
          prisma.sale.count({
            where: {
              commercialServiceId: service.id,
              vehicleNumber: { not: "BPO-OUTBOUND" },
              ...monthWhere,
            },
          }),
        ),
        prismaRetry(() =>
          prisma.deliveryOrder.count({
            where: {
              commercialServiceId: service.id,
              status: ValidationStatus.PENDING,
              ...monthWhere,
            },
          }),
        ),
        prismaRetry(() =>
          prisma.sale.count({
            where: {
              commercialServiceId: service.id,
              status: ValidationStatus.PENDING,
              ...monthWhere,
              lines: {
                some: { product: { productCat: { isBottled: false } } },
              },
            },
          }),
        ),
      ]);

      const profile = profileFromCommercialService(service);
      return {
        code: service.code,
        name: service.name,
        siteKind: profile.siteKind,
        saleCount,
        pendingDoCount,
        pendingSaleCount,
      };
    }),
  );

  return { monthFilter, lines };
}

export type LineDashboardSummary = {
  serviceCode: string;
  serviceName: string;
  siteKind: string;
  saleCount: number;
  pendingDoCount: number;
  pendingSaleCount: number;
};

export async function getLineDashboardSummary(
  session: AuthSession,
  serviceCodeRaw: string,
): Promise<LineDashboardSummary | { error: string }> {
  const code = normalizeServiceCodeParam(serviceCodeRaw);
  if (!code) return { error: "Invalid service code." };
  if (!canAccessLineDashboard(session, code)) {
    return { error: "You do not have access to this line dashboard." };
  }

  const prisma = getPrismaClient();
  const service = await prismaRetry(() =>
    prisma.commercialService.findFirst({
      where: { code: { equals: code, mode: "insensitive" }, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        siteKind: true,
        enabledModules: true,
      },
    }),
  );
  if (!service) return { error: "Commercial line not found." };

  const { monthFilter } = await resolveReportWorkingMonthFilter();
  const monthWhere = monthFilter
    ? {
        financialYear: monthFilter.financialYear,
        postingCalendarYear: monthFilter.postingCalendarYear,
        financialMonth: monthFilter.financialMonth,
      }
    : {};

  const [saleCount, pendingDoCount, pendingSaleCount] = await Promise.all([
    prismaRetry(() =>
      prisma.sale.count({
        where: {
          commercialServiceId: service.id,
          vehicleNumber: { not: "BPO-OUTBOUND" },
          ...monthWhere,
        },
      }),
    ),
    prismaRetry(() =>
      prisma.deliveryOrder.count({
        where: {
          commercialServiceId: service.id,
          status: ValidationStatus.PENDING,
          ...monthWhere,
        },
      }),
    ),
    prismaRetry(() =>
      prisma.sale.count({
        where: {
          commercialServiceId: service.id,
          status: ValidationStatus.PENDING,
          ...monthWhere,
          lines: {
            some: { product: { productCat: { isBottled: false } } },
          },
        },
      }),
    ),
  ]);

  const profile = profileFromCommercialService(service);
  return {
    serviceCode: service.code,
    serviceName: service.name,
    siteKind: profile.siteKind,
    saleCount,
    pendingDoCount,
    pendingSaleCount,
  };
}

export function canAccessExecutiveDashboardForSession(
  session: AuthSession,
): boolean {
  return canAccessExecutiveDashboard(session);
}
