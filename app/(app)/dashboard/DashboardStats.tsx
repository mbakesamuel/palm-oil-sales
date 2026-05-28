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

  const [saleCount, pendingDoCount, pendingSaleCount] = await Promise.all([
    prisma.sale.count({ where: saleWhere }),
    prisma.deliveryOrder.count({
      where: { ...deliveryWhere, status: ValidationStatus.PENDING },
    }),
    prisma.sale.count({
      where: {
        AND: [
          saleWhere,
          { status: ValidationStatus.PENDING },
          {
            lines: {
              some: { product: { productCat: { isBottled: false } } },
            },
          },
        ],
      },
    }),
  ]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Link
        href="/reports/sales"
        className="rounded-xl border border-brand/30 bg-brand/12 p-4 shadow-sm transition-all hover:border-brand/45 hover:bg-brand/18 hover:shadow-md"
      >
        <div className="text-2xl font-semibold tabular-nums text-brand">
          {saleCount}
        </div>
        <div className="mt-1 text-sm text-foreground/80">Sales this working month</div>
      </Link>
      <Link
        href="/delivery-orders"
        className="rounded-xl border border-accent/50 bg-accent/28 p-4 shadow-sm transition-all hover:border-accent/65 hover:bg-accent/38 hover:shadow-md"
      >
        <div className="text-2xl font-semibold tabular-nums text-accent-foreground">
          {pendingDoCount}
        </div>
        <div className="mt-1 text-sm text-accent-foreground/85">
          Pending delivery orders
        </div>
      </Link>
      <Link
        href="/pos"
        className="rounded-xl border border-brand/30 border-l-4 border-l-accent bg-brand/10 p-4 shadow-sm transition-all hover:border-brand/45 hover:bg-brand/16 hover:shadow-md"
      >
        <div className="text-2xl font-semibold tabular-nums text-brand">
          {pendingSaleCount}
        </div>
        <div className="mt-1 text-sm text-foreground/80">Pending sales</div>
      </Link>
    </div>
  );
}
