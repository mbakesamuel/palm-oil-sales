import type { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  PUBLIC_RELATION_POS_CUSTOMER_NAME,
  RATION_POS_CUSTOMER_NAME,
  WALK_IN_CUSTOMER_NAME,
} from "@/lib/pos/sale-product-mode";
import {
  customerWhereForScope,
  type ServiceScope,
} from "@/lib/service-scope";

export const POS_PLACEHOLDER_CUSTOMER_NAMES = [
  WALK_IN_CUSTOMER_NAME,
  RATION_POS_CUSTOMER_NAME,
  PUBLIC_RELATION_POS_CUSTOMER_NAME,
] as const;

const EXCLUDE_POS_PLACEHOLDERS: Prisma.CustomerWhereInput = {
  isPosPlaceholder: false,
};

/** Customer pickers on DO, POS, and operational reports (not Customers setup). */
export function customerWhereForOperationalUI(
  scope: ServiceScope,
): Prisma.CustomerWhereInput {
  const scoped = customerWhereForScope(scope);
  if (!scoped) return EXCLUDE_POS_PLACEHOLDERS;
  return { AND: [scoped, EXCLUDE_POS_PLACEHOLDERS] };
}

/** Exclude POS system customers from sale-based report aggregations. */
export function saleWhereExcludingPosPlaceholderCustomers<
  W extends Prisma.SaleWhereInput,
>(base: W): W {
  return {
    AND: [base, { customer: { isPosPlaceholder: false } }],
  } as W;
}

export async function assertCustomerSelectableForOperations(
  prisma: PrismaClient,
  customerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(customerId ?? "").trim();
  if (!id) return { ok: false, error: "Customer is required." };

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { isPosPlaceholder: true },
  });
  if (!customer) return { ok: false, error: "Customer not found." };
  if (customer.isPosPlaceholder) {
    return {
      ok: false,
      error:
        "This customer is reserved for POS walk-in, ration, or public-relation sales and cannot be used here.",
    };
  }
  return { ok: true };
}
