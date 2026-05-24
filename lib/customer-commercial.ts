import "server-only";

import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import {
  commercialServiceErrorForOperations,
  commercialServiceErrorForResource,
  type ServiceScope,
} from "@/lib/service-scope";

export function commercialServiceErrorForCustomer(
  scope: ServiceScope,
  customerCommercialServiceId: string | null | undefined,
): string | null {
  return commercialServiceErrorForResource(scope, customerCommercialServiceId);
}

/** Leadership must pick a line on the form; operational users use their assignment. */
export function resolveCustomerCommercialServiceId(
  scope: ServiceScope,
  formCommercialServiceId: string,
): string {
  const opErr = commercialServiceErrorForOperations(scope);
  if (opErr) throw new Error(opErr);
  if (scope.mode === "single") return scope.commercialServiceId;
  const id = formCommercialServiceId.trim();
  if (!id) throw new Error("Commercial line is required.");
  return id;
}

export async function assertTaxRegimeForCommercialLine(
  prisma: PrismaClient,
  taxRegimeId: string,
  commercialServiceId: string,
) {
  const regime = await prisma.taxRegime.findUnique({
    where: { id: taxRegimeId },
    select: { id: true, commercialServiceId: true },
  });
  if (!regime) throw new Error("Tax regime not found.");
  if (regime.commercialServiceId && regime.commercialServiceId !== commercialServiceId) {
    throw new Error("Tax regime does not belong to the selected commercial line.");
  }
}

export async function assertCustomerAccessible(
  prisma: PrismaClient,
  session: AuthSession,
  scope: ServiceScope,
  customerId: string,
): Promise<{ commercialServiceId: string }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { commercialServiceId: true },
  });
  if (!customer) throw new Error("Customer not found.");
  const err = commercialServiceErrorForCustomer(scope, customer.commercialServiceId);
  if (err) throw new Error(err);
  return customer;
}

export function assertCustomerMatchesPostingLine(
  customerCommercialServiceId: string,
  postingCommercialServiceId: string,
): string | null {
  if (customerCommercialServiceId !== postingCommercialServiceId) {
    return "This customer belongs to another commercial line.";
  }
  return null;
}

export async function validateCustomerForCommercialPosting(
  prisma: PrismaClient,
  scope: ServiceScope,
  customerId: string,
  postingCommercialServiceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { commercialServiceId: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };
  const custErr = commercialServiceErrorForCustomer(scope, customer.commercialServiceId);
  if (custErr) return { ok: false, error: custErr };
  const lineMismatch = assertCustomerMatchesPostingLine(
    customer.commercialServiceId,
    postingCommercialServiceId,
  );
  if (lineMismatch) return { ok: false, error: lineMismatch };
  return { ok: true };
}
