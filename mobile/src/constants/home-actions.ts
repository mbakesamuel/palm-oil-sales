import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import { reportLinks, stockLinks } from "@/constants/home-links";
import type { AgroIconTone } from "@/theme/agro";

export type HomeTabId = "dashboard" | "approvals" | "more";

export type HomeAction = {
  id: string;
  label: string;
  href: string;
  permission: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  tone: AgroIconTone;
  tab: HomeTabId;
  description?: string;
};

/** Fixed tone per module so each tile stays visually distinct (like the sample). */
const reportToneById: Record<string, AgroIconTone> = {
  "stock-vs-commitments": "forest",
  "stock-inquiry": "palm",
  "daily-sales-summary": "harvest",
  commitments: "sun",
};

const stockToneById: Record<string, AgroIconTone> = {
  receipts: "leaf",
  transfers: "amber",
  "transfers-receive": "clay",
};

const reportIcons: Record<string, ComponentProps<typeof Ionicons>["name"]> = {
  "stock-vs-commitments": "stats-chart-outline",
  "stock-inquiry": "search-outline",
  "daily-sales-summary": "calendar-outline",
  commitments: "git-compare-outline",
};

export const homeReportActions: HomeAction[] = reportLinks.map((r) => ({
  id: r.id,
  label: r.label,
  href: `/(app)/reports/${r.id}`,
  permission: r.permission,
  icon: reportIcons[r.id] ?? "document-text-outline",
  tone: reportToneById[r.id] ?? "sage",
  tab: "dashboard",
}));

export const homeStockActions: HomeAction[] = stockLinks.map((s) => ({
  id: s.id,
  label: s.label,
  href: `/(app)/stock/${s.id}`,
  permission: s.permission,
  icon: (
    {
      receipts: "archive-outline",
      transfers: "swap-horizontal-outline",
      "transfers-receive": "download-outline",
    } as const
  )[s.id],
  tone: stockToneById[s.id] ?? "moss",
  tab: "approvals",
  description: s.description,
}));

export const homeApprovalAction: HomeAction = {
  id: "validation",
  label: "Approvals inbox",
  href: "/(app)/validation",
  permission: "__approvals__",
  icon: "checkmark-done-outline",
  tone: "forest",
  tab: "approvals",
  description: "Review sales and delivery orders",
};

export const homeMoreActions: HomeAction[] = [
  {
    id: "sign-out",
    label: "Sign out",
    href: "__sign_out__",
    permission: "__always__",
    icon: "log-out-outline",
    tone: "clay",
    tab: "more",
    description: "End this session",
  },
];

export const homeTabs: Array<{ id: HomeTabId; label: string }> = [
  { id: "dashboard", label: "My Dashboard" },
  { id: "approvals", label: "My Approvals" },
  { id: "more", label: "Others" },
];
