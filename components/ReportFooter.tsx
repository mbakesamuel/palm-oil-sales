import * as React from "react";
import { ReportSignatory } from "@/components/ReportSignatory";

/**
 * Minimal footer for printed reports.
 *
 * - Left: generated date/time.
 * - Right: page number via CSS `@page` counters (Chromium/Edge/Safari support;
 *   Firefox silently omits, which is acceptable degradation).
 * - Optional signature block (re-uses `ReportSignatory`).
 */
export function ReportFooter(props: {
  generatedAt?: Date;
  /** When true, render the role-aware signature line above the meta footer. */
  signatory?: boolean;
  /** Optional extra meta line (e.g. financial-year context, filter summary). */
  meta?: React.ReactNode;
}) {
  const { generatedAt = new Date(), signatory = false, meta } = props;
  const generatedLabel = generatedAt.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      {signatory ? <ReportSignatory /> : null}
      <footer className="mt-8 border-t border-border pt-2 text-xs opacity-75 print:mt-6 print:border-black/30 print:break-inside-avoid">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="tabular-nums">Generated {generatedLabel}</span>
          {meta ? <span className="tabular-nums">{meta}</span> : null}
          <span className="tabular-nums print:hidden">
            Page numbers appear on the printed copy.
          </span>
        </div>
      </footer>
      <style>{`
        @page {
          margin: 12mm 12mm 16mm 12mm;
          @bottom-right {
            content: "Page " counter(page) " of " counter(pages);
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9pt;
            color: #444;
          }
        }
      `}</style>
    </>
  );
}
