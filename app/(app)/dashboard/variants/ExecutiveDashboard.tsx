import Link from "next/link";
import { getPrismaClient } from "@/lib/prisma";
import { lineDashboardPath } from "@/lib/dashboard-routing";
import { profileFromCommercialService } from "@/lib/commercial-profile";
import { resolveReportWorkingMonthFilter } from "@/lib/report-working-month-filter";
import { DashboardShell } from "../_shared/DashboardShell";
import { DashboardSessionCard } from "../DashboardSessionCard";
import { ValidationStatus } from "@prisma/client";

export async function ExecutiveDashboard() {
  const prisma = await getPrismaClient();
  const { monthFilter } = await resolveReportWorkingMonthFilter();

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

  const summaries = await Promise.all(
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
      };
    }),
  );

  return (
    <DashboardShell
      title="Executive dashboard"
      subtitle="Cross-line overview for the current working month. Open a line dashboard for operational detail."
    >
      <DashboardSessionCard />

      <div className="grid gap-4">
        {summaries.map((line) => (
          <article
            key={line.code}
            className="rounded-xl border border-border p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{line.name}</h2>
                <p className="text-xs opacity-70">
                  {line.siteKind === "FACTORY" ? "Factory line" : "Sales point line"}
                </p>
              </div>
              <Link
                href={lineDashboardPath(line.code)}
                className="text-sm underline underline-offset-4 opacity-90 hover:opacity-100"
              >
                Open line dashboard
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-2">
                <div className="text-xl font-semibold tabular-nums text-brand">
                  {line.saleCount}
                </div>
                <div className="text-xs opacity-80">Sales this month</div>
              </div>
              <div className="rounded-lg border border-accent/40 bg-accent/20 px-3 py-2">
                <div className="text-xl font-semibold tabular-nums">
                  {line.pendingDoCount}
                </div>
                <div className="text-xs opacity-80">Pending delivery orders</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="text-xl font-semibold tabular-nums">
                  {line.pendingSaleCount}
                </div>
                <div className="text-xs opacity-80">Pending sales</div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
