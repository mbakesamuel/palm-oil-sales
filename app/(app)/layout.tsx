export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Prisma } from "@prisma/client";
import { BrandingProvider } from "@/components/BrandingProvider";
import { WorkingPeriodBanner } from "@/components/WorkingPeriodBanner";
import { WorkingPeriodProvider } from "@/contexts/WorkingPeriodContext";
import { getServerSession } from "@/lib/auth-server";
import { assertRouteAllowedForPath } from "@/lib/access-control";
import { INVOKE_PATH_HEADER } from "@/auth.config";
import { headers } from "next/headers";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { resolveCompanyLogoSrc } from "@/lib/company-logo";
import { getDefaultCommercialInvoicePrefix } from "@/lib/commercial-service";
import { getOrInitCompanySettings } from "@/lib/settings";
import { resolveHomeDashboardPath } from "@/lib/dashboard-routing";
import { redirect } from "next/navigation";
import { reportNavItems, reportNavSections } from "@/lib/reports-catalog";
import { Sidebar } from "./Sidebar";

const setupNav = [
  { href: "/setup", label: "General Parameters" },
  { href: "/setup/commercial-services", label: "Sales Services" },
  { href: "/setup/sales-budget", label: "Sales budget Phasing" },
  { href: "/setup/product-pricing", label: "Product pricing" },
  { href: "/setup/role-access", label: "Role access" },
  { href: "/setup/permissions", label: "User access control" },
  { href: "/users", label: "Users" },
  { href: "/customers", label: "Customers" },
  { href: "/financial-years", label: "Financial years" },
  { href: "/sales-points", label: "Sales points" },
  { href: "/factories", label: "Factories" },
  { href: "/tax-regimes", label: "Tax regimes" },
  { href: "/tax-types", label: "Tax types" },
  { href: "/product-categories", label: "Product categories" },
  { href: "/products", label: "Products" },
] as const;

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

  const [settings, openPeriod, invoicePrefix] = await Promise.all([
    getOrInitCompanySettings(),
    getOpenFinancialYearPeriod(),
    getDefaultCommercialInvoicePrefix(),
  ]);
  const vatPct = new Prisma.Decimal(String(settings.vatRate))
    .mul(100)
    .toDecimalPlaces(2)
    .toString();
  const subtitle = `Currency: XAF · VAT: ${vatPct}% · Invoice prefix: ${invoicePrefix}`;
  const dashboardNav = [
    { href: resolveHomeDashboardPath(session), label: "Dashboard" },
  ] as const;

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
        <div className="h-full min-h-0 overflow-hidden print:h-auto print:overflow-visible">
          <div className="flex h-full min-h-0 w-full flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:gap-6 print:block print:px-6 print:py-4">
            <div className="w-full max-md:min-w-0 max-md:overflow-hidden shrink-0 overflow-x-auto md:h-full md:min-h-0 md:w-20 md:max-w-20 md:shrink-0 md:overflow-hidden lg:max-w-none lg:w-auto print:hidden">
              <Sidebar
                brand={settings.companyName}
                department={settings.department}
                logoSrc={resolveCompanyLogoSrc(settings.logoUrl)}
                subtitle={subtitle}
                dashboardNav={[...dashboardNav]}
                setupNav={[...setupNav]}
                operationsNav={[...operationsNav]}
                reportNav={reportNavItems()}
                reportNavSections={reportNavSections()}
              />
            </div>

            <section className="min-w-0 flex flex-1 flex-col gap-3 min-h-0 print:w-full print:overflow-visible">
              <div className="shrink-0 print:hidden">
                <WorkingPeriodBanner />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border p-4 sm:p-6 print:overflow-visible print:border-0 print:shadow-none print:p-0 print:rounded-none">
                {children}
              </div>
            </section>
          </div>
        </div>
      </WorkingPeriodProvider>
    </BrandingProvider>
  );
}
