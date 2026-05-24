import type { PermissionKey } from "@/lib/access-control-keys";

export type ReportGroupId =
  | "sales"
  | "delivery"
  | "stock"
  | "budget"
  | "pricing"
  | "bpo";

export type ReportDefinition = {
  group: ReportGroupId;
  groupLabel: string;
  href: string;
  label: string;
  description: string;
  permissionKey: PermissionKey;
};

export const REPORT_GROUP_ORDER: { id: ReportGroupId; label: string }[] = [
  { id: "sales", label: "Sales" },
  { id: "delivery", label: "Delivery orders" },
  { id: "stock", label: "Stock" },
  { id: "budget", label: "Budget phasing" },
  { id: "pricing", label: "Pricing" },
  { id: "bpo", label: "Bottled Palm Oil" },
];

export const REPORTS: ReportDefinition[] = [
  {
    group: "sales",
    groupLabel: "Sales",
    href: "/reports/sales",
    label: "Sales register",
    description: "Invoices, customers, net / VAT / gross (XAF).",
    permissionKey: "route:/reports/sales",
  },
  {
    group: "sales",
    groupLabel: "Sales",
    href: "/reports/daily-sales-summary",
    label: "Daily sales summary",
    description:
      "One calendar day inside the working month: validated sales only — customers, DOs, quantities, DO balance (kg), and totals by customer type.",
    permissionKey: "route:/reports/daily-sales-summary",
  },
  {
    group: "delivery",
    groupLabel: "Delivery orders",
    href: "/reports/delivery-orders",
    label: "Delivery orders",
    description: "Recent delivery orders with line totals and fiscal period.",
    permissionKey: "route:/reports/delivery-orders",
  },
  {
    group: "delivery",
    groupLabel: "Delivery orders",
    href: "/reports/delivery-order-monitor",
    label: "View DOs by DO-Number",
    description:
      "Look up by DO number: header, sales history, quantities and amounts vs invoiced.",
    permissionKey: "route:/reports/delivery-order-monitor",
  },
  {
    group: "delivery",
    groupLabel: "Delivery orders",
    href: "/reports/customer-delivery-monitor",
    label: "View DOs by customer",
    description:
      "All delivery orders for a customer with lines, sales, and complete / incomplete status.",
    permissionKey: "route:/reports/customer-delivery-monitor",
  },
  {
    group: "delivery",
    groupLabel: "Delivery orders",
    href: "/reports/do-commitment-crosstab",
    label: "Commitments",
    description:
      "Customer × product × sales points: outstanding ordered vs invoiced quantity, with row and column totals (validated DOs and sales).",
    permissionKey: "route:/reports/do-commitment-crosstab",
  },
  {
    group: "stock",
    groupLabel: "Stock",
    href: "/reports/stock-on-hand",
    label: "Stock on hand",
    description:
      "Remaining kg by storage location and product (crosstab); consolidated grade summary when applicable.",
    permissionKey: "route:/reports/stock-on-hand",
  },
  {
    group: "stock",
    groupLabel: "Stock",
    href: "/reports/stock-vs-commitments",
    label: "Stock vs commitments",
    description:
      "By product: physical stock vs outstanding validated delivery order quantity (ordered minus invoiced) per collection point, with balance.",
    permissionKey: "route:/reports/stock-vs-commitments",
  },
  {
    group: "budget",
    groupLabel: "Budget phasing",
    href: "/reports/sales-budget-monthly-crosstab",
    label: "Budget phasing (monthly)",
    description: "Monthly sales budget crosstab by product and period.",
    permissionKey: "route:/reports/sales-budget-monthly-crosstab",
  },
  {
    group: "budget",
    groupLabel: "Budget phasing",
    href: "/reports/sales-budget-weekly-crosstab",
    label: "Budget phasing (weekly)",
    description: "Weekly sales budget crosstab by product and period.",
    permissionKey: "route:/reports/sales-budget-weekly-crosstab",
  },
  {
    group: "pricing",
    groupLabel: "Pricing",
    href: "/reports/pricing",
    label: "Product & variant pricing",
    description:
      "Unit prices (ex tax) for the open financial year — Main category (by customer type) and other products; filter by effective date or latest schedules.",
    permissionKey: "route:/reports/pricing",
  },
  {
    group: "pricing",
    groupLabel: "Pricing",
    href: "/reports/pricing#bottled",
    label: "Bottled variant prices",
    description:
      "Bottled product sizes and scheduled unit prices (section of the unified pricing report).",
    permissionKey: "route:/reports/pricing",
  },
  {
    group: "bpo",
    groupLabel: "Bottled Palm Oil",
    href: "/reports/bpo",
    label: "BPO monitor",
    description:
      "BPO stock, two-stage consignments, Bota sales, gift/out movements, and discrepancies.",
    permissionKey: "route:/reports/bpo",
  },
  {
    group: "bpo",
    groupLabel: "Bottled Palm Oil",
    href: "/reports/bpo-sales-crosstab",
    label: "BPO sales crosstab",
    description: "BPO sales by variant and sales point (crosstab).",
    permissionKey: "route:/reports/bpo-sales-crosstab",
  },
  {
    group: "bpo",
    groupLabel: "Bottled Palm Oil",
    href: "/reports/bpo-stock-cross",
    label: "BPO stock cross",
    description: "BPO stock positions across sales points (cross-tab).",
    permissionKey: "route:/reports/bpo-stock-cross",
  },
];

export type ReportNavItem = { href: string; label: string };

export function reportNavItems(): ReportNavItem[] {
  return REPORTS.map((r) => ({ href: r.href, label: r.label }));
}

export type ReportNavSection = { sectionLabel: string; items: ReportNavItem[] };

/** Sidebar: preserve catalog order within each group. */
export function reportNavSections(): ReportNavSection[] {
  return REPORT_GROUP_ORDER.map(({ id, label }) => ({
    sectionLabel: label,
    items: REPORTS.filter((r) => r.group === id).map((r) => ({
      href: r.href,
      label: r.label,
    })),
  })).filter((s) => s.items.length > 0);
}

export function reportsByGroup(): { id: ReportGroupId; label: string; reports: ReportDefinition[] }[] {
  return REPORT_GROUP_ORDER.map(({ id, label }) => ({
    id,
    label,
    reports: REPORTS.filter((r) => r.group === id),
  })).filter((g) => g.reports.length > 0);
}
