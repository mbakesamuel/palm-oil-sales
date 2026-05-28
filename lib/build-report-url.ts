export type ReportUrlParamValue = string | number | null | undefined;

/** Build a report path with optional search params (safe for server and client). */
export function buildReportUrl(
  href: string,
  params?: Record<string, ReportUrlParamValue>,
): string {
  if (!params) return href;
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    if (raw == null) continue;
    const value = typeof raw === "number" ? String(raw) : raw.trim();
    if (value === "") continue;
    search.set(key, value);
  }
  const qs = search.toString();
  if (!qs) return href;
  return href.includes("?") ? `${href}&${qs}` : `${href}?${qs}`;
}
