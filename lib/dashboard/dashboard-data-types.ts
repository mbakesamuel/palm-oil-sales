/** Client-safe dashboard view-model types (serializable props for client components). */

import type { CommercialModuleKey } from "@/lib/commercial-modules";
import type { DashboardQuickLink } from "@/lib/dashboard-widgets";
import type {
  DashboardKpis,
  DashboardMonthFilter,
  IncomingTransferRow,
  StatusSlice,
  StockKpis,
  TrendPoint,
} from "@/lib/dashboard/types";

export type PalmOilDashboardData = {
  scopeError: string | null;
  monthFilter: DashboardMonthFilter | null;
  hasOpenFy: boolean;
  kpis: DashboardKpis | null;
  salesTrend: TrendPoint[];
  doTrend: TrendPoint[];
  salesStatus: StatusSlice[];
  doStatus: StatusSlice[];
  stock: StockKpis | null;
  incomingTransfers: IncomingTransferRow[];
  showStock: boolean;
  scopedSalesPointId: number | null;
  serviceName: string;
  enabledModules: readonly CommercialModuleKey[];
};

export type ExecutiveLineSummary = {
  code: string;
  name: string;
  siteKind: string;
  saleCount: number;
  pendingDoCount: number;
  pendingSaleCount: number;
  href: string;
};

export type ExecutiveDashboardData = {
  monthFilter: DashboardMonthFilter | null;
  hasOpenFy: boolean;
  kpis: DashboardKpis;
  salesTrend: TrendPoint[];
  doTrend: TrendPoint[];
  salesStatus: StatusSlice[];
  doStatus: StatusSlice[];
  lineShare: StatusSlice[];
  lines: ExecutiveLineSummary[];
};

export type RubberDashboardData = {
  monthFilter: DashboardMonthFilter | null;
  hasOpenFy: boolean;
  stock: StockKpis | null;
  transferTrend: TrendPoint[];
  transferStatus: StatusSlice[];
  incomingTransfers: IncomingTransferRow[];
  showStock: boolean;
  scopedSalesPointId: number | null;
  serviceName: string;
  enabledModules: readonly CommercialModuleKey[];
};

export type GenericDashboardData = {
  serviceName: string;
  enabledModules: readonly CommercialModuleKey[];
  monthFilter: DashboardMonthFilter | null;
  hasOpenFy: boolean;
  moduleCount: number;
  quickLinks: DashboardQuickLink[];
};
