import { TaxRegimeKind } from "@prisma/client";

export const REGIME_TYPE_LABELS: Record<TaxRegimeKind, string> = {
  SIMPLIFIED: "Simplified",
  REAL: "Real",
};

export function regimeTypeHint(kind: TaxRegimeKind): string {
  return kind === TaxRegimeKind.REAL
    ? "Uses the Real sales tax rate from Tax rates."
    : "Uses the Simplified sales tax rate from Tax rates.";
}
