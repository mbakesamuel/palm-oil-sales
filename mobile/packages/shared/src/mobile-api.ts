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
  /** Workflow role (line role code wins over stale `User.role`). */
  role: string;
  /** Human-readable role for UI (line role name or legacy label). */
  roleLabel: string;
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

export type MobileSaleDetail = {
  id: string;
  invoiceNo: string;
  soldAtIso: string;
  salesPointName: string | null;
  customerName: string;
  deliveryOrderNo: string | null;
  vehicleNumber: string;
  createdByName: string;
  status: string;
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  lines: Array<{
    productName: string;
    productCat: string;
    qtyLabel: string;
    unitPriceLabel: string;
    lineGross: string;
  }>;
  payments: Array<{
    method: string;
    amount: string;
    reference: string | null;
  }>;
};

export type MobilePendingConsignmentRow = {
  id: string;
  consignmentNoteNo: string;
  invoiceNo: string;
  customerName: string;
  destination: string;
  vehicleNumber: string;
  dateOfConsignmentIso: string;
  salesPointName: string | null;
};

export type MobileConsignmentDetail = {
  id: string;
  consignmentNoteNo: string;
  status: string;
  invoiceNo: string;
  customerName: string;
  salesPointName: string | null;
  destination: string;
  vehicleNumber: string;
  dateOfLiftingIso: string;
  dateOfConsignmentIso: string;
  consignerName: string;
  consignerDesignation: string;
  receiverName: string;
  receiverNicNo: string;
  receiverNicPlaceOfIssue: string;
  receivedDateIso: string | null;
  deliveryOrderNo: string | null;
  createdByName: string;
  validatedByName: string | null;
  validatedAtIso: string | null;
  lines: Array<{
    lineNo: number;
    productName: string;
    qtyKg: string;
  }>;
};

export type MobileDeliveryOrderDetail = {
  id: number;
  deliveryOrderNo: string;
  dateIssuedIso: string;
  salesPointName: string;
  customerName: string;
  status: string;
  reviewedAtIso: string | null;
  reviewedByName: string | null;
  orderRef: string | null;
  totalAmountXaf: string;
  lines: Array<{
    productName: string;
    orderQty: string;
    orderUnit: string;
    amount: string | null;
  }>;
  payments: Array<{
    method: string;
    amount: string;
    reference: string | null;
  }>;
};

export type MobileReceiptDetail = {
  id: string;
  receiptNo: string;
  salesPointName: string;
  supplierLabel: string;
  status: string;
  receivedAtIso: string;
  createdByName: string;
  createdAtIso: string;
  postedByName: string | null;
  postedAtIso: string | null;
  notes: string | null;
  totalQty: string;
  lines: Array<{
    productName: string;
    qty: string;
    uom: string;
    storageLocationName: string;
  }>;
};

export type MobileTransferDetail = {
  id: string;
  transferNo: string;
  fromSalesPointName: string;
  toSalesPointName: string;
  status: string;
  dispatchedAtIso: string | null;
  receivedAtIso: string | null;
  createdByName: string;
  createdAtIso: string;
  dispatchedByName: string | null;
  receivedByName: string | null;
  notes: string | null;
  totalQty: string;
  lines: Array<{
    id: string;
    productName: string;
    qty: string;
    uom: string;
    fromStorageLocationName: string;
    toStorageLocationName: string | null;
  }>;
  receiveLocations?: Array<{
    id: number;
    name: string;
    isSellable: boolean;
  }>;
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
  {
    id: "bota-bottle-stock",
    label: "Bota bottle stock",
    permission: "route:/reports/bota-bottle-stock",
    path: `${MOBILE_API_PREFIX}/reports/bota-bottle-stock`,
  },
] as const;

export type MobileReceiptListRow = {
  id: string;
  receiptNo: string;
  salesPointName: string;
  supplierLabel: string;
  status: string;
  totalQty: string;
  lineCount: number;
  createdByName: string;
  receivedAtIso: string;
};

export type MobileTransferListRow = {
  id: string;
  transferNo: string;
  fromSalesPointName: string;
  toSalesPointName: string;
  status: string;
  totalQty: string;
  lineCount: number;
  createdByName: string;
  dispatchedAtIso: string | null;
};

export const MOBILE_STOCK_LINKS = [
  {
    id: "receipts",
    label: "Stock receipts",
    description: "Review clerk drafts, then post into stock",
    permission: "ui:post-stock-receipt",
  },
  {
    id: "transfers",
    label: "Stock transfers",
    description: "Review drafts, then dispatch",
    permission: "ui:dispatch-stock-transfer",
  },
  {
    id: "transfers-receive",
    label: "Receive transfers",
    description: "Review in transit, then receive",
    permission: "ui:receive-stock-transfer",
  },
] as const;
