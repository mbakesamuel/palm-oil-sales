import type { PermissionKey } from "@/lib/access-control-keys";

export type SetupGroupId =
  | "company"
  | "access"
  | "sites"
  | "tax"
  | "payment"
  | "products"
  | "customers";

export type SetupNavDefinition = {
  group: SetupGroupId;
  groupLabel: string;
  href: string;
  label: string;
  permissionKey: PermissionKey;
};

export const SETUP_GROUP_ORDER: { id: SetupGroupId; label: string }[] = [
  { id: "company", label: "Company" },
  { id: "access", label: "Access & users" },
  { id: "sites", label: "Sites & periods" },
  { id: "tax", label: "Tax" },
  { id: "payment", label: "Payment methods" },
  { id: "products", label: "Products & pricing" },
  { id: "customers", label: "Customers" },
];

export const SETUP_NAV: SetupNavDefinition[] = [
  {
    group: "company",
    groupLabel: "Company",
    href: "/setup/commercial-services",
    label: "Sales services",
    permissionKey: "route:/setup/commercial-services",
  },
  {
    group: "access",
    groupLabel: "Access & users",
    href: "/setup/permissions",
    label: "Roles & access",
    permissionKey: "route:/setup/permissions",
  },
  {
    group: "access",
    groupLabel: "Access & users",
    href: "/users",
    label: "Users",
    permissionKey: "route:/users",
  },
  {
    group: "sites",
    groupLabel: "Sites & periods",
    href: "/financial-years",
    label: "Financial years",
    permissionKey: "route:/financial-years",
  },
  {
    group: "sites",
    groupLabel: "Sites & periods",
    href: "/sales-points",
    label: "Sales points",
    permissionKey: "route:/sales-points",
  },
  {
    group: "sites",
    groupLabel: "Sites & periods",
    href: "/factories",
    label: "Factories",
    permissionKey: "route:/factories",
  },
  {
    group: "tax",
    groupLabel: "Tax",
    href: "/tax-regimes",
    label: "Tax regimes",
    permissionKey: "route:/tax-regimes",
  },
  {
    group: "tax",
    groupLabel: "Tax",
    href: "/tax-types",
    label: "Tax types",
    permissionKey: "route:/tax-types",
  },
  {
    group: "tax",
    groupLabel: "Tax",
    href: "/setup/tax-rates",
    label: "Tax rates",
    permissionKey: "route:/setup/tax-rates",
  },
  {
    group: "payment",
    groupLabel: "Payment methods",
    href: "/setup/payment-methods",
    label: "Payment methods",
    permissionKey: "route:/setup/payment-methods",
  },
  {
    group: "products",
    groupLabel: "Products & pricing",
    href: "/product-categories",
    label: "Product categories",
    permissionKey: "route:/product-categories",
  },
  {
    group: "products",
    groupLabel: "Products & pricing",
    href: "/products",
    label: "Products",
    permissionKey: "route:/products",
  },
  {
    group: "products",
    groupLabel: "Products & pricing",
    href: "/setup/product-pricing",
    label: "Product pricing",
    permissionKey: "route:/setup/product-pricing",
  },
  {
    group: "products",
    groupLabel: "Products & pricing",
    href: "/setup/sales-budget",
    label: "Sales budget phasing",
    permissionKey: "route:/setup/sales-budget",
  },
  {
    group: "customers",
    groupLabel: "Customers",
    href: "/customers",
    label: "Customers",
    permissionKey: "route:/customers",
  },
];

export type SetupNavItem = { href: string; label: string };

/** Flat list (permissions + path matching). */
export function setupNavItems(): SetupNavItem[] {
  return SETUP_NAV.map((item) => ({ href: item.href, label: item.label }));
}

export type SetupNavSection = { sectionLabel: string; items: SetupNavItem[] };

/** Sidebar: labeled sub-sections within Settings. */
export function setupNavSections(): SetupNavSection[] {
  return SETUP_GROUP_ORDER.map(({ id, label }) => ({
    sectionLabel: label,
    items: SETUP_NAV.filter((item) => item.group === id).map((item) => ({
      href: item.href,
      label: item.label,
    })),
  })).filter((s) => s.items.length > 0);
}
