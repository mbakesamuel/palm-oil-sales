/** Shared mobile API contracts (client-safe). */

export const MOBILE_API_PREFIX = "/api/mobile/v1";

export type MobileAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type MobileSessionPayload = {
  userId: string;
  username: string;
  displayName: string;
  role: string;
  globalRole: { id: string; code: string; displayName: string } | null;
  salesPoint: { id: number; name: string } | null;
  factory: { id: string; name: string } | null;
  service: string | null;
  commercialService: {
    id: string;
    code: string;
    name: string;
    invoicePrefix: string;
    siteKind: string;
    enabledModules: string[];
  } | null;
  commercialServiceRole: { id: string; code: string; name: string } | null;
};

export type MobileLoginResponse = {
  session: MobileSessionPayload;
  permissions: string[];
  tokens: MobileAuthTokens;
};

export type MobileMeResponse = {
  session: MobileSessionPayload;
  permissions: string[];
};

export type MobilePendingSaleRow = {
  id: string;
  invoiceNo: string;
  soldAtIso: string;
  customerName: string;
  totalLabel: string;
  salesPointName: string | null;
};

export const MOBILE_REPORT_LINKS = [
  {
    id: "stock-vs-commitments",
    label: "Stock vs commitments",
    permission: "route:/reports/stock-vs-commitments",
    path: `${MOBILE_API_PREFIX}/reports/stock-vs-commitments`,
  },
  {
    id: "stock-inquiry",
    label: "Stock inquiry",
    permission: "route:/reports/stock-inquiry",
    path: `${MOBILE_API_PREFIX}/reports/stock-inquiry`,
  },
  {
    id: "daily-sales-summary",
    label: "Daily sales summary",
    permission: "route:/reports/daily-sales-summary",
    path: `${MOBILE_API_PREFIX}/reports/daily-sales-summary`,
  },
  {
    id: "commitments",
    label: "DO commitments",
    permission: "route:/reports/do-commitment-crosstab",
    path: `${MOBILE_API_PREFIX}/reports/commitments`,
  },
] as const;
