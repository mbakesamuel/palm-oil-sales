import type { CommercialModuleKey } from "@/lib/commercial-modules";

export type DashboardQuickLink = {
  href: string;
  title: string;
  description: string;
  module: CommercialModuleKey;
};

export const DASHBOARD_QUICK_LINKS: DashboardQuickLink[] = [
  {
    href: "/pos",
    title: "Sales",
    description: "Create a sale (cash/cheque).",
    module: "palm_operations",
  },
  {
    href: "/delivery-orders",
    title: "Delivery orders",
    description: "Raise and track delivery orders.",
    module: "palm_operations",
  },
  {
    href: "/rubber",
    title: "Rubber sales",
    description: "Factory rubber sales hub.",
    module: "rubber_operations",
  },
  {
    href: "/stock",
    title: "Stock",
    description: "Receipts, transfers, and adjustments.",
    module: "stock",
  },
  {
    href: "/products",
    title: "Products",
    description: "Manage products; categories live under Setup.",
    module: "catalog",
  },
  {
    href: "/customers",
    title: "Customers",
    description: "Tax regime, taxpayer ID, contact info.",
    module: "customers",
  },
  {
    href: "/setup",
    title: "Setup",
    description: "Company, VAT rate, invoice prefix.",
    module: "setup",
  },
  {
    href: "/factories",
    title: "Factories",
    description: "Factory sites for this commercial line.",
    module: "factories",
  },
  {
    href: "/sales-points",
    title: "Sales points",
    description: "Collection points for this line.",
    module: "sales_points",
  },
  {
    href: "/reports",
    title: "Reports",
    description: "Printable operational reports.",
    module: "palm_reports",
  },
];

export function quickLinksForModules(
  enabledModules: readonly CommercialModuleKey[],
): DashboardQuickLink[] {
  const enabled = new Set(enabledModules);
  return DASHBOARD_QUICK_LINKS.filter((link) => enabled.has(link.module));
}
