export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { Prisma } from "@prisma/client";
import { BrandingProvider } from "@/components/BrandingProvider";
import { getOrInitCompanySettings } from "@/lib/settings";
import { Sidebar } from "./Sidebar";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pos", label: "POS" },
  { href: "/delivery-orders", label: "Delivery orders" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/tax-regimes", label: "Tax regimes" },
  { href: "/sales-points", label: "Sales points" },
  { href: "/setup", label: "Setup" },
] as const;

const reportNav = [
  { href: "/reports/sales", label: "POS sales" },
  { href: "/reports/delivery-orders", label: "Delivery orders" },
] as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const settings = await getOrInitCompanySettings();
  const vatPct = new Prisma.Decimal(String(settings.vatRate)).mul(100).toDecimalPlaces(2).toString();
  const subtitle = `Currency: XAF · VAT: ${vatPct}%`;

  return (
    <BrandingProvider
      value={{
        companyName: settings.companyName,
        department: settings.department ?? null,
      }}
    >
      <div className="min-h-[calc(100vh-41px)] print:min-h-0">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 flex flex-col gap-6 lg:flex-row print:max-w-none print:px-6 print:py-4 print:block">
          <div className="print:hidden shrink-0">
            <Sidebar
              brand={settings.companyName}
              department={settings.department}
              subtitle={subtitle}
              nav={[...nav]}
              reportNav={[...reportNav]}
            />
          </div>

          <section className="min-w-0 flex-1 print:w-full">
            <div className="rounded-2xl border border-black/10 dark:border-white/10 p-4 sm:p-6 print:border-0 print:shadow-none print:p-0 print:rounded-none">
              {children}
            </div>
          </section>
        </div>
      </div>
    </BrandingProvider>
  );
}

