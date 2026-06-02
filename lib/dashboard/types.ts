/** Client-safe dashboard types (no server imports). */

export type TrendPoint = { label: string; value: number };

export type StatusSlice = { name: string; value: number };

export type DashboardKpis = {
  saleCount: number;
  grossValue: number;
  pendingDoCount: number;
  pendingSaleCount: number;
  validatedSaleCount: number;
  validatedRatePct: number | null;
};

export type StockKpis = {
  pendingReceiptCount: number;
  incomingTransferCount: number;
  outboundDraftTransferCount: number;
  pendingTransferCount: number;
  scopeHint: string;
};

export type IncomingTransferRow = {
  id: string;
  transferNo: string;
  fromName: string;
  toName: string;
  dispatchedIso: string;
  lineCount: number;
};

export type DashboardMonthFilter = {
  financialYear: number;
  postingCalendarYear: number;
  financialMonth: number;
  label: string;
};
