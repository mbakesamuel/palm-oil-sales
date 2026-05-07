"use client";

export function PricingReportPrintButton() {
  return (
    <button
      type="button"
      className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
      onClick={() => {
        window.open("/api/print/pricing-report", "_blank", "noopener,noreferrer");
      }}
    >
      Print pricing report
    </button>
  );
}

