/** Client-safe payment method shape (no Prisma). */
export type PaymentMethodKind = "SIMPLE" | "CHEQUE" | "TRAITE" | "CREDIT";

export type PaymentMethodOption = {
  id: string;
  code: string;
  name: string;
  kind: PaymentMethodKind;
};

export const PAYMENT_METHOD_KIND_LABELS: Record<
  Exclude<PaymentMethodKind, "CREDIT">,
  string
> = {
  SIMPLE: "Simple (amount only)",
  CHEQUE: "Cheque (requires cheque number)",
  TRAITE: "Traite (requires traite details)",
};
