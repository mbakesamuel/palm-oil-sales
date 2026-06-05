import { getPrismaClient } from "@/lib/prisma";
import type { PaymentMethodKind, PaymentMethodOption } from "@/lib/payment-methods/types";
import { PaymentMethodKind as PrismaPaymentMethodKind } from "@prisma/client";

export const BUILTIN_PAYMENT_METHOD_CODES = [
  "CASH",
  "CHEQUE",
  "TRAITE",
  "CREDIT",
] as const;

const BUILTIN_SEED: Array<{
  id: string;
  code: string;
  name: string;
  kind: PrismaPaymentMethodKind;
  sortOrder: number;
}> = [
  { id: "pm_cash", code: "CASH", name: "Cash", kind: "SIMPLE", sortOrder: 10 },
  { id: "pm_cheque", code: "CHEQUE", name: "Cheque", kind: "CHEQUE", sortOrder: 20 },
  { id: "pm_traite", code: "TRAITE", name: "Traite", kind: "TRAITE", sortOrder: 30 },
  { id: "pm_credit", code: "CREDIT", name: "Credit", kind: "CREDIT", sortOrder: 40 },
];

export function toPaymentMethodOption(row: {
  id: string;
  code: string;
  name: string;
  kind: PrismaPaymentMethodKind;
}): PaymentMethodOption {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind as PaymentMethodKind,
  };
}

export async function ensureBuiltinPaymentMethods() {
  const prisma = getPrismaClient();
  for (const row of BUILTIN_SEED) {
    await prisma.paymentMethodDefinition.upsert({
      where: { code: row.code },
      create: {
        id: row.id,
        code: row.code,
        name: row.name,
        kind: row.kind,
        sortOrder: row.sortOrder,
        isActive: true,
        isSystem: true,
      },
      update: {
        name: row.name,
        kind: row.kind,
        sortOrder: row.sortOrder,
        isSystem: true,
      },
    });
  }
}

export async function listPaymentMethodDefinitions(opts?: {
  activeOnly?: boolean;
  kinds?: PaymentMethodKind[];
}): Promise<PaymentMethodOption[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.paymentMethodDefinition.findMany({
    where: {
      ...(opts?.activeOnly ? { isActive: true } : {}),
      ...(opts?.kinds?.length ? { kind: { in: opts.kinds } } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, kind: true },
  });
  return rows.map(toPaymentMethodOption);
}

export async function getPaymentMethodById(id: string) {
  const prisma = getPrismaClient();
  return prisma.paymentMethodDefinition.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      kind: true,
      isActive: true,
      isSystem: true,
    },
  });
}

export async function assertPaymentMethodUsable(id: string) {
  const row = await getPaymentMethodById(id);
  if (!row) throw new Error("Payment method not found.");
  if (!row.isActive) throw new Error("Payment method is inactive.");
  return row;
}

export type PaymentFieldInput = {
  chequeNo?: string | null;
  bank?: string | null;
  traiteNo?: string | null;
  traiteIssuedOn?: string | null;
  traiteMaturityOn?: string | null;
};

export type PreparedPaymentFields = {
  chequeNo: string | null;
  bank: string | null;
  traiteNo: string | null;
  traiteIssuedOn: Date | null;
  traiteMaturityOn: Date | null;
};

export function validatePaymentFields(
  kind: PaymentMethodKind,
  input: PaymentFieldInput,
  helpers: {
    normalizeIsoDateInput: (raw: string) => string | null;
    noonUtcFromIsoDate: (iso: string) => Date;
  },
): PreparedPaymentFields {
  let chequeNo: string | null = null;
  let bank: string | null = null;
  let traiteNo: string | null = null;
  let traiteIssuedOn: Date | null = null;
  let traiteMaturityOn: Date | null = null;

  if (kind === "CHEQUE") {
    chequeNo = String(input.chequeNo ?? "").trim() || null;
    const bankRaw = String(input.bank ?? "").trim();
    bank = bankRaw ? bankRaw : null;
    if (!chequeNo) {
      throw new Error("Cheque number is required for cheque payments.");
    }
  } else if (kind === "TRAITE") {
    traiteNo = String(input.traiteNo ?? "").trim() || null;
    const bankRaw = String(input.bank ?? "").trim();
    bank = bankRaw ? bankRaw : null;
    const issuedIso = helpers.normalizeIsoDateInput(String(input.traiteIssuedOn ?? ""));
    const maturityIso = helpers.normalizeIsoDateInput(String(input.traiteMaturityOn ?? ""));
    if (!traiteNo) throw new Error("Traite number is required for traite payments.");
    if (!bank) throw new Error("Bank is required for traite payments.");
    if (!issuedIso) throw new Error("Traite date issued is required.");
    if (!maturityIso) throw new Error("Traite maturity date is required.");
    traiteIssuedOn = helpers.noonUtcFromIsoDate(issuedIso);
    traiteMaturityOn = helpers.noonUtcFromIsoDate(maturityIso);
    if (traiteMaturityOn < traiteIssuedOn) {
      throw new Error("Traite maturity date cannot be before the date issued.");
    }
  }

  return { chequeNo, bank, traiteNo, traiteIssuedOn, traiteMaturityOn };
}
