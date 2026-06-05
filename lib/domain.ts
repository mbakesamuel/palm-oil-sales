/**
 * Shared domain enums/types for client + server.
 *
 * IMPORTANT: Do not import `@prisma/client` here.
 * Client bundles must stay Prisma-free (Vercel/Turbopack build).
 */

export const UserRole = {
  ADMIN: "ADMIN",
  DIRECTOR: "DIRECTOR",
  MANAGER: "MANAGER",
  OFFICER: "OFFICER",
  SENIOR_SUPERVISOR: "SENIOR_SUPERVISOR",
  SUPERVISOR: "SUPERVISOR",
  CLERK: "CLERK",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ValidationStatus = {
  PENDING: "PENDING",
  VALIDATED: "VALIDATED",
  REJECTED: "REJECTED",
} as const;
export type ValidationStatus =
  (typeof ValidationStatus)[keyof typeof ValidationStatus];

export const PaymentMethodKind = {
  SIMPLE: "SIMPLE",
  CHEQUE: "CHEQUE",
  TRAITE: "TRAITE",
  CREDIT: "CREDIT",
} as const;
export type PaymentMethodKind =
  (typeof PaymentMethodKind)[keyof typeof PaymentMethodKind];

export const FinancialYearStatus = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;
export type FinancialYearStatus =
  (typeof FinancialYearStatus)[keyof typeof FinancialYearStatus];

export const CustomerType = {
  INDUSTRY: "INDUSTRY",
  WHOLE_SALE: "WHOLE_SALE",
  RETAIL: "RETAIL",
  WORKER: "WORKER",
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const CustomerResidency = {
  LOCAL: "LOCAL",
  OVERSEAS: "OVERSEAS",
} as const;
export type CustomerResidency =
  (typeof CustomerResidency)[keyof typeof CustomerResidency];
