"use client";

import Link from "next/link";
import type { StockActivityItem } from "@/lib/load-stock-operations-page";

const kindLabel: Record<StockActivityItem["kind"], string> = {
  receipt_loose: "Receive",
  receipt_bottled: "Receive",
  transfer: "Transfer",
  issue: "Issue",
};

export function StockActivityFeed(props: { items: StockActivityItem[] }) {
  const { items } = props;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <p className="text-sm opacity-75">
          Receipts, transfers, and outbound movements in your scope (newest first).
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Reference</th>
              <th className="px-3 py-2 font-medium">Detail</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 opacity-75">
                  No stock activity in scope yet.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-b border-border odd:bg-foreground/[0.04]">
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{row.atIso}</td>
                  <td className="px-3 py-2">{kindLabel[row.kind]}</td>
                  <td className="px-3 py-2 font-medium">{row.title}</td>
                  <td className="px-3 py-2 text-xs opacity-90">{row.subtitle}</td>
                  <td className="px-3 py-2">
                    {row.statusLabel ? (
                      <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs">
                        {row.statusLabel}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.href ? (
                      <Link href={row.href} className="text-xs underline underline-offset-4">
                        View
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
