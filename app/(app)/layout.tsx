export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { BrandingProvider } from "@/components/BrandingProvider";
import { AppShellMainSection } from "@/components/AppShellMainSection";
import { WorkingPeriodProvider } from "@/contexts/WorkingPeriodContext";
import { getServerSession } from "@/lib/auth-server";
import { assertRouteAllowedForPath } from "@/lib/access-control";
import { INVOKE_PATH_HEADER } from "@/auth.config";
import { headers } from "next/headers";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { resolveCompanyLogoSrc } from "@/lib/company-logo";
import { getOrInitCompanySettings } from "@/lib/settings";
import {
  formatAppShellFooterLine,
  formatAppShellSidebarSubtitle,
  resolveAppShellFooterContext,
} from "@/lib/app-shell-footer";
import { AppShellFooter } from "@/components/AppShellFooter";
import {
  isDashboardPath,
  resolveHomeDashboardPath,
} from "@/lib/dashboard-routing";
import { redirect } from "next/navigation";
import { reportNavItems, reportNavSections } from "@/lib/reports-catalog";
import { setupNavItems, setupNavSections } from "@/lib/setup-catalog";
import { Sidebar } from "./Sidebar";

const operationsNav = [
  { href: "/rubber", label: "Rubber sales" },
  { href: "/delivery-orders", label: "Delivery orders" },
  { href: "/delivery-orders/list", label: "Delivery orders list" },
  {
    href: "/delivery-orders/validation-queue",
    label: "DO validation queue",
  },
  { href: "/consignment-notes", label: "Vehicle Consignment" },
  { href: "/pos", label: "Sales Invoice" },
  { href: "/pos/list", label: "Sales list" },
  { href: "/stock", label: "Stock" },
] as const;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const h = await headers();
  // `x-invoke-path` is forwarded by `proxy.ts`. In some deployments the platform may also provide
  // `x-matched-path`, so keep it as a fallback to avoid failing open.
  const pathname = (
    h.get(INVOKE_PATH_HEADER) ??
    h.get("x-matched-path") ??
    ""
  ).trim();
  // `proxy.ts` already enforced `route:*` on `request.nextUrl.pathname`. The invoke-path
  // header is missing on some RSC sub-requests; do not treat that as forbidden here.
  if (pathname) {
    await assertRouteAllowedForPath(pathname, session);
  }

  const [settings, openPeriod] = await Promise.all([
    getOrInitCompanySettings(),
    getOpenFinancialYearPeriod(),
  ]);
  const footerCtx = await resolveAppShellFooterContext(session, settings);
  const subtitle = formatAppShellSidebarSubtitle(footerCtx);
  const footerLine = formatAppShellFooterLine(footerCtx);
  const dashboardNav = [
    { href: resolveHomeDashboardPath(session), label: "Dashboard" },
  ] as const;
  const isDashboard = pathname ? isDashboardPath(pathname) : false;

  return (
    <BrandingProvider
      value={{
        companyName: settings.companyName,
        department: settings.department ?? null,
      }}
    >
      <WorkingPeriodProvider
        openFinancialYear={openPeriod?.financialYear ?? null}
        openPeriodStartIso={
          openPeriod ? prismaDateToIso(openPeriod.startDate) : null
        }
        openPeriodEndIso={
          openPeriod ? prismaDateToIso(openPeriod.endDate) : null
        }
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden print:h-auto print:overflow-visible">
          <div className="min-h-0 flex-1 overflow-hidden print:overflow-visible">
            <div
              className={[
                "flex h-full min-h-0 w-full flex-col md:flex-row print:block print:px-6 print:py-4",
                isDashboard
                  ? "gap-2 px-2 py-2 sm:gap-3 sm:px-3 sm:py-3 md:gap-4 md:px-4"
                  : "gap-4 px-4 py-6 sm:px-6 md:gap-6",
              ].join(" ")}
            >
              <div className="w-full max-md:min-w-0 max-md:overflow-hidden shrink-0 overflow-x-auto md:h-full md:min-h-0 md:w-20 md:max-w-20 md:shrink-0 md:overflow-hidden lg:max-w-none lg:w-auto print:hidden">
                <Sidebar
                  brand={settings.companyName}
                  department={settings.department}
                  logoSrc={resolveCompanyLogoSrc(settings.logoUrl)}
                  subtitle={subtitle}
                  dashboardNav={[...dashboardNav]}
                  setupNav={setupNavItems()}
                  setupNavSections={setupNavSections()}
                  operationsNav={[...operationsNav]}
                  reportNav={reportNavItems()}
                  reportNavSections={reportNavSections()}
                />
              </div>

              <AppShellMainSection>{children}</AppShellMainSection>
            </div>
          </div>
          <AppShellFooter line={footerLine} />
        </div>      </WorkingPeriodProvider>
    </BrandingProvider>
  );
}
