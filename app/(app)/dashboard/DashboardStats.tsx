import Link from "next/link";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import { resolveReportWorkingMonthFilter } from "@/lib/report-working-month-filter";
import {
  commercialServiceErrorForOperations,
  deliveryOrderWhereForScope,
  resolveServiceScope,
  saleWhereForScope,
} from "@/lib/service-scope";
import { ValidationStatus } from "@prisma/client";

export async function DashboardStats() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const scope = resolveServiceScope(session);
  const scopeErr = commercialServiceErrorForOperations(scope);
  if (scopeErr) {
    return (
      <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
        {scopeErr}
      </div>
    );
  }

  const scopedToSalesPoint = roleRequiresSalesPoint(session.role);
  const assignedSalesPointId = session.salesPoint?.id ?? null;
  const [{ monthFilter }, prisma] = await Promise.all([
    resolveReportWorkingMonthFilter(),
    getPrismaClient(),
  ]);

  const saleBase = {
    vehicleNumber: { not: "BPO-OUTBOUND" as const },
    ...(scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {}),
    ...(monthFilter
      ? {
          financialYear: monthFilter.financialYear,
          postingCalendarYear: monthFilter.postingCalendarYear,
          financialMonth: monthFilter.financialMonth,
        }
      : {}),
  };

  const saleScopeFilter = saleWhereForScope(scope);
  const saleWhere = saleScopeFilter ? { AND: [saleBase, saleScopeFilter] } : saleBase;

  const doBase = {
    ...(scopedToSalesPoint && assignedSalesPointId != null
      ? { salesPointId: assignedSalesPointId }
      : {}),
    ...(monthFilter
      ? {
          financialYear: monthFilter.financialYear,
          postingCalendarYear: monthFilter.postingCalendarYear,
          financialMonth: monthFilter.financialMonth,
        }
      : {}),
  };

  const doScopeFilter = deliveryOrderWhereForScope(scope);
  const deliveryWhere = doScopeFilter ? { AND: [doBase, doScopeFilter] } : doBase;

  const [saleCount, pendingDoCount] = await Promise.all([
    prisma.sale.count({ where: saleWhere }),
    prisma.deliveryOrder.count({
      where: { ...deliveryWhere, status: ValidationStatus.PENDING },
    }),
  ]);

  const lineLabel =
    scope.mode === "single" && session.commercialService
      ? session.commercialService.name
      : "All commercial lines";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Link
        href="/reports/sales"
        className="rounded-lg border border-border p-4 hover:bg-accent/25"
      >
        <div className="text-sm opacity-75">{lineLabel}</div>
        <div className="text-2xl font-semibold tabular-nums">{saleCount}</div>
        <div className="text-sm opacity-75">Sales this working month</div>
      </Link>
      <Link
        href="/delivery-orders"
        className="rounded-lg border border-border p-4 hover:bg-accent/25"
      >
        <div className="text-sm opacity-75">{lineLabel}</div>
        <div className="text-2xl font-semibold tabular-nums">{pendingDoCount}</div>
        <div className="text-sm opacity-75">Pending delivery orders</div>
      </Link>
    </div>
  );
}
