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
  CLERK_IN_CHARGE_BPO: "CLERK_IN_CHARGE_BPO",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ValidationStatus = {
  PENDING: "PENDING",
  VALIDATED: "VALIDATED",
  REJECTED: "REJECTED",
} as const;
export type ValidationStatus =
  (typeof ValidationStatus)[keyof typeof ValidationStatus];

export const BpoMovementType = {
  CONSIGNMENT_TRANSFER: "CONSIGNMENT_TRANSFER",
  GIFT: "GIFT",
  OTHER_OUT: "OTHER_OUT",
} as const;
export type BpoMovementType =
  (typeof BpoMovementType)[keyof typeof BpoMovementType];

export const BpoMovementStatus = {
  DRAFT: "DRAFT",
  SENDER_VALIDATED: "SENDER_VALIDATED",
  VALIDATED: "VALIDATED",
  REJECTED: "REJECTED",
} as const;
export type BpoMovementStatus =
  (typeof BpoMovementStatus)[keyof typeof BpoMovementStatus];

export const PaymentMethod = {
  CASH: "CASH",
  CHEQUE: "CHEQUE",
  CREDIT: "CREDIT",
  TRAITE: "TRAITE",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

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
