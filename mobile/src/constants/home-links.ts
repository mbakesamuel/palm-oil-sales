import { MOBILE_REPORT_LINKS, MOBILE_STOCK_LINKS } from "@pos/shared";

/** Defensive fallbacks when Metro resolves a stale @pos/shared copy. */
export const reportLinks = MOBILE_REPORT_LINKS ?? [];
export const stockLinks =
  MOBILE_STOCK_LINKS ??
  ([
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
  ] as const);
