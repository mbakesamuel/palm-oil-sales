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
import { redirect } from "next/navigation";
import { reportNavItems, reportNavSections } from "@/lib/reports-catalog";
import { Sidebar } from "./Sidebar";

const dashboardNav = [{ href: "/dashboard", label: "Dashboard" }] as const;

const setupNav = [
  { href: "/setup", label: "General Parameters" },
  { href: "/setup/commercial-services", label: "Sales Services" },
  { href: "/setup/sales-budget", label: "Sales budget Phasing" },
  { href: "/setup/product-pricing", label: "Product pricing" },
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
  { href: "/consignment-notes", label: "Vehicle Consignment" },
  { href: "/pos", label: "Sales Invoice" },
  { href: "/bpo-sales", label: "Bottled Palm Oil sales" },
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
        <div className="h-screen overflow-hidden print:h-auto print:overflow-visible">
          <div className="mx-auto w-full max-w-[min(100rem,calc(100vw-1.5rem))] px-4 py-6 h-full min-h-0 flex flex-col gap-4 md:flex-row md:gap-6 print:max-w-none print:px-6 print:py-4 print:block">
            <div className="print:hidden shrink-0 w-full max-md:min-w-0 md:h-full md:w-20 md:max-w-20 md:shrink-0 md:overflow-y-auto lg:max-w-none lg:w-auto overflow-x-auto overflow-y-visible md:overflow-x-visible">
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
