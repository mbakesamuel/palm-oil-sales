import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Boxes,
  Calendar,
  CalendarRange,
  Circle,
  CircleDollarSign,
  ClipboardList,
  Factory,
  FileText,
  FolderTree,
  LayoutGrid,
  LayoutDashboard,
  Layers,
  MapPin,
  Package,
  Receipt,
  Scale,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  Table2,
  TableProperties,
  Tags,
  Target,
  Truck,
  UserCircle,
  Users,
  Users2,
} from "lucide-react";

const HREF_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/setup": Settings,
  "/setup/sales-budget": Target,
  "/setup/product-pricing": Tags,
  "/setup/bpo-variants": Layers,
  "/setup/product-variants": Layers,
  "/setup/permissions": Shield,
  "/users": Users,
  "/customers": UserCircle,
  "/financial-years": CalendarRange,
  "/sales-points": MapPin,
  "/factories": Factory,
  "/rubber": Factory,
  "/tax-regimes": Scale,
  "/tax-types": Receipt,
  "/product-categories": FolderTree,
  "/products": Package,
  "/delivery-orders": Truck,
  "/consignment-notes": FileText,
  "/pos": ShoppingCart,
  "/bpo-sales": CircleDollarSign,
  "/stock": Boxes,
  "/reports": BarChart3,
  "/reports/sales": BookOpen,
  "/reports/daily-sales-summary": Calendar,
  "/reports/delivery-orders": ClipboardList,
  "/reports/delivery-order-monitor": Search,
  "/reports/customer-delivery-monitor": Users2,
  "/reports/do-commitment-crosstab": Table2,
  "/reports/stock-on-hand": Boxes,
  "/reports/sales-budget-monthly-crosstab": LayoutGrid,
  "/reports/sales-budget-weekly-crosstab": LayoutGrid,
  "/reports/pricing": CircleDollarSign,
  "/reports/bpo-pricing": Layers,
  "/reports/bpo": Factory,
  "/reports/bpo-sales-crosstab": TableProperties,
};

export type NavGroupIconId = "setup" | "operations" | "reports";

const GROUP_ICONS: Record<NavGroupIconId, LucideIcon> = {
  setup: Settings,
  operations: Truck,
  reports: BarChart3,
};

export function navIconForHref(href: string): LucideIcon {
  return HREF_ICONS[href] ?? Circle;
}

export function navIconForGroup(id: string): LucideIcon {
  if (id === "setup" || id === "operations" || id === "reports") {
    return GROUP_ICONS[id];
  }
  return Circle;
}
