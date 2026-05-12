/** Public path under `public/` or absolute http(s) URL from company settings. */
export function resolveCompanyLogoSrc(logoUrl: string | null | undefined): string {
  const t = String(logoUrl ?? "").trim();
  return t !== "" ? t : "/cdc-logo-svg.svg";
}
