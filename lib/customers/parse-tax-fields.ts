import "server-only";

export type ParsedCustomerTaxFields = {
  taxRegimeId: string | null;
  hasTaxpayerId: boolean;
  taxpayerId: string | null;
};

/** Regime selected ⇒ registered taxpayer; no regime ⇒ no TPN path (10% SAT when applicable). */
export function parseCustomerTaxFieldsFromForm(formData: FormData): ParsedCustomerTaxFields {
  const taxRegimeRaw = String(
    formData.get("taxRegimeId") ?? formData.get("taxRegime") ?? "",
  ).trim();
  const taxRegimeId = taxRegimeRaw.length ? taxRegimeRaw : null;
  const taxpayerIdRaw = String(formData.get("taxpayerId") ?? "").trim() || null;

  if (!taxRegimeId) {
    return { taxRegimeId: null, hasTaxpayerId: false, taxpayerId: null };
  }

  return {
    taxRegimeId,
    hasTaxpayerId: true,
    taxpayerId: taxpayerIdRaw,
  };
}
