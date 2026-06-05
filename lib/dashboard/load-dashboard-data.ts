import "server-only";

import { redirect } from "next/navigation";
import { getPermissionsForSession } from "@/lib/access-control";
import { getServerSession } from "@/lib/auth-server";
import { sessionRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import { resolveReportWorkingMonthFilter } from "@/lib/report-working-month-filter";
import {
  commercialServiceErrorForOperations,
  resolveServiceScope,
  type ServiceScope,
} from "@/lib/service-scope";
import {
  getDashboardKpis,
  getDeliveryOrderStatusBreakdown,
  getDeliveryOrderTrendByMonth,
  getIncomingTransfers,
  getLineSalesShare,
  getSalesStatusBreakdown,
  getSalesTrendByMonth,
  getStockKpis,
  getTransferStatusBreakdown,
  getTransferTrendByMonth,
} from "@/lib/services/dashboard-analytics";
import { getPrismaClient } from "@/lib/prisma";
import { profileFromCommercialService } from "@/lib/commercial-profile";
import { lineDashboardPath } from "@/lib/dashboard-routing";
import { ValidationStatus } from "@prisma/client";
import type { CommercialModuleKey } from "@/lib/commercial-modules";
import { quickLinksForModules } from "@/lib/dashboard-widgets";
import type {
  ExecutiveDashboardData,
  GenericDashboardData,
  PalmOilDashboardData,
  RubberDashboardData,
} from "@/lib/dashboard/dashboard-data-types";

export type {
  ExecutiveDashboardData,
  ExecutiveLineSummary,
  GenericDashboardData,
  PalmOilDashboardData,
  RubberDashboardData,
} from "@/lib/dashboard/dashboard-data-types";

export async function loadPalmOilDashboardData(
  commercialServiceId: string,
  serviceName: string,
  enabledModules: readonly CommercialModuleKey[],
): Promise<PalmOilDashboardData> {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scope: ServiceScope = { mode: "single", commercialServiceId };
  const scopeError = commercialServiceErrorForOperations(scope);
  const perms = await getPermissionsForSession(session);
  const showStock = Boolean(perms["route:/stock"]);

  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const salesPointId =
    scopedToSalesPoint && session.salesPoint?.id != null ? session.salesPoint.id : null;

  const { monthFilter, hasOpenFy } = await resolveReportWorkingMonthFilter();

  if (scopeError) {
    return {
      scopeError,
      monthFilter,
      hasOpenFy,
      kpis: null,
      salesTrend: [],
      doTrend: [],
      salesStatus: [],
      doStatus: [],
      stock: null,
      incomingTransfers: [],
      showStock,
      scopedSalesPointId: salesPointId,
      serviceName,
      enabledModules,
    };
  }

  const scopeHint =
    salesPointId != null
      ? (session.salesPoint?.name ?? "Your sales point")
      : "All sales points";

  const [
    kpis,
    salesTrend,
    doTrend,
    salesStatus,
    doStatus,
    stock,
    incomingTransfers,
  ] = await Promise.all([
    getDashboardKpis(scope, monthFilter, salesPointId),
    getSalesTrendByMonth(scope, monthFilter, salesPointId),
    getDeliveryOrderTrendByMonth(scope, monthFilter, salesPointId),
    getSalesStatusBreakdown(scope, monthFilter, salesPointId),
    getDeliveryOrderStatusBreakdown(scope, monthFilter, salesPointId),
    showStock ? getStockKpis(salesPointId, scopeHint) : Promise.resolve(null),
    showStock ? getIncomingTransfers(salesPointId) : Promise.resolve([]),
  ]);

  return {
    scopeError: null,
    monthFilter,
    hasOpenFy,
    kpis,
    salesTrend,
    doTrend,
    salesStatus,
    doStatus,
    stock,
    incomingTransfers,
    showStock,
    scopedSalesPointId: salesPointId,
    serviceName,
    enabledModules,
  };
}

export async function loadExecutiveDashboardData(): Promise<ExecutiveDashboardData> {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scope = resolveServiceScope(session);
  const { monthFilter, hasOpenFy } = await resolveReportWorkingMonthFilter();
  const prisma = getPrismaClient();

  const services = await prisma.commercialService.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      siteKind: true,
      enabledModules: true,
    },
  });

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
        prisma.sale.count({
          where: {
            commercialServiceId: service.id,
            vehicleNumber: { not: "BPO-OUTBOUND" },
            ...monthWhere,
          },
        }),
        prisma.deliveryOrder.count({
          where: {
            commercialServiceId: service.id,
            status: ValidationStatus.PENDING,
            ...monthWhere,
          },
        }),
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
      ]);
      const profile = profileFromCommercialService(service);
      return {
        code: service.code,
        name: service.name,
        siteKind: profile.siteKind,
        saleCount,
        pendingDoCount,
        pendingSaleCount,
        href: lineDashboardPath(service.code),
      };
    }),
  );

  const [
    kpis,
    salesTrend,
    doTrend,
    salesStatus,
    doStatus,
    lineShare,
  ] = await Promise.all([
    getDashboardKpis(scope, monthFilter),
    getSalesTrendByMonth(scope, monthFilter),
    getDeliveryOrderTrendByMonth(scope, monthFilter),
    getSalesStatusBreakdown(scope, monthFilter),
    getDeliveryOrderStatusBreakdown(scope, monthFilter),
    getLineSalesShare(monthFilter),
  ]);

  return {
    monthFilter,
    hasOpenFy,
    kpis,
    salesTrend,
    doTrend,
    salesStatus,
    doStatus,
    lineShare,
    lines,
  };
}

export async function loadRubberDashboardData(
  serviceName: string,
  enabledModules: readonly CommercialModuleKey[],
): Promise<RubberDashboardData> {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const perms = await getPermissionsForSession(session);
  const showStock = Boolean(perms["route:/stock"]);
  const scopedToSalesPoint = sessionRequiresFixedPostingSite(session);
  const salesPointId =
    scopedToSalesPoint && session.salesPoint?.id != null ? session.salesPoint.id : null;
  const { monthFilter, hasOpenFy } = await resolveReportWorkingMonthFilter();

  const scopeHint =
    salesPointId != null
      ? (session.salesPoint?.name ?? "Your sales point")
      : "All sales points";

  const [stock, transferTrend, transferStatus, incomingTransfers] = await Promise.all([
    showStock ? getStockKpis(salesPointId, scopeHint) : Promise.resolve(null),
    showStock ? getTransferTrendByMonth(monthFilter, salesPointId) : Promise.resolve([]),
    showStock ? getTransferStatusBreakdown(salesPointId) : Promise.resolve([]),
    showStock ? getIncomingTransfers(salesPointId) : Promise.resolve([]),
  ]);

  return {
    monthFilter,
    hasOpenFy,
    stock,
    transferTrend,
    transferStatus,
    incomingTransfers,
    showStock,
    scopedSalesPointId: salesPointId,
    serviceName,
    enabledModules,
  };
}

export async function loadGenericDashboardData(
  serviceName: string,
  enabledModules: readonly CommercialModuleKey[],
): Promise<GenericDashboardData> {
  const { monthFilter, hasOpenFy } = await resolveReportWorkingMonthFilter();
  return {
    serviceName,
    enabledModules,
    monthFilter,
    hasOpenFy,
    moduleCount: enabledModules.length,
    quickLinks: quickLinksForModules(enabledModules),
  };
}
