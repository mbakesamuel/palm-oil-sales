export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Prisma } from "@prisma/client";
import { BrandingProvider } from "@/components/BrandingProvider";
import { WorkingPeriodBanner } from "@/components/WorkingPeriodBanner";
import { WorkingPeriodProvider } from "@/contexts/WorkingPeriodContext";
import { getOpenFinancialYearPeriod } from "@/lib/financial-year";
import { prismaDateToIso } from "@/lib/posting-calendar";
import { getOrInitCompanySettings } from "@/lib/settings";
import { Sidebar } from "./Sidebar";

const dashboardNav = [{ href: "/dashboard", label: "Dashboard" }] as const;

const setupNav = [
  { href: "/setup", label: "Setup" },
  { href: "/users", label: "Users" },
  { href: "/customers", label: "Customers" },
  { href: "/financial-years", label: "Financial years" },
  { href: "/sales-points", label: "Sales points" },
  { href: "/tax-regimes", label: "Tax regimes" },
  { href: "/product-categories", label: "Product categories" },
  { href: "/products", label: "Products" },
] as const;

const operationsNav = [
  { href: "/delivery-orders", label: "Delivery orders" },
  { href: "/pos", label: "Sales" },
] as const;

const reportNav = [
  { href: "/reports/sales", label: "Sales register" },
  { href: "/reports/delivery-orders", label: "Delivery orders" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [settings, openPeriod] = await Promise.all([
    getOrInitCompanySettings(),
    getOpenFinancialYearPeriod(),
  ]);
  const vatPct = new Prisma.Decimal(String(settings.vatRate)).mul(100).toDecimalPlaces(2).toString();
  const subtitle = `Currency: XAF · VAT: ${vatPct}%`;

  return (
    <BrandingProvider
      value={{
        companyName: settings.companyName,
        department: settings.department ?? null,
      }}
    >
      <WorkingPeriodProvider
        openFinancialYear={openPeriod?.financialYear ?? null}
        openPeriodStartIso={openPeriod ? prismaDateToIso(openPeriod.startDate) : null}
        openPeriodEndIso={openPeriod ? prismaDateToIso(openPeriod.endDate) : null}
      >
        <div className="h-screen overflow-hidden print:h-auto print:overflow-visible">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 h-full flex flex-col gap-6 lg:flex-row print:max-w-none print:px-6 print:py-4 print:block">
            <div className="print:hidden shrink-0 h-full overflow-y-auto">
              <Sidebar
                brand={settings.companyName}
                department={settings.department}
                subtitle={subtitle}
                dashboardNav={[...dashboardNav]}
                setupNav={[...setupNav]}
                operationsNav={[...operationsNav]}
                reportNav={[...reportNav]}
              />
            </div>

            <section className="min-w-0 flex-1 overflow-y-auto print:w-full print:overflow-visible">
              <WorkingPeriodBanner />
              <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4 sm:p-6 print:border-0 print:shadow-none print:p-0 print:rounded-none">
                {children}
              </div>
            </section>
          </div>
        </div>
      </WorkingPeriodProvider>
    </BrandingProvider>
  );
}

