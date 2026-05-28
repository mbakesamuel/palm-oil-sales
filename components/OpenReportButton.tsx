"use client";

import { useRouter } from "next/navigation";
import {
  buildReportUrl,
  type ReportUrlParamValue,
} from "@/lib/build-report-url";

type ParamValue = ReportUrlParamValue;

/**
 * Replaces in-page `window.print()` calls for reports.
 *
 * By default opens a dedicated `/print` route in a new tab. Set `sameTab` to
 * navigate in the current tab instead (use `AutoPrint` with `closeOnFinish={false}`
 * on the print page so the app tab is not closed after printing).
 */
export function OpenReportButton(props: {
  href: string;
  params?: Record<string, ParamValue>;
  label?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  /** Navigate to the print route in this tab instead of `window.open`. */
  sameTab?: boolean;
}) {
  const {
    href,
    params,
    label = "Print report",
    className,
    disabled = false,
    title,
    sameTab = false,
  } = props;
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      className={
        className ??
        "rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
      }
      onClick={() => {
        const url = buildReportUrl(href, params);
        if (sameTab) {
          router.push(url);
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      }}
    >
      {label}
    </button>
  );
}
