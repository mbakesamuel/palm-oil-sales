import type { Prisma } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import type { UserRole } from "@/lib/domain";
import { UserRole as UserRoleEnum } from "@/lib/domain";

export type ServiceScope =
  | { mode: "all" }
  | { mode: "single"; commercialServiceId: string }
  | { mode: "none" };

/** Leadership and org-wide managers see every commercial line. */
export function roleSeesAllCommercialServices(role: UserRole): boolean {
  return (
    role === UserRoleEnum.ADMIN ||
    role === UserRoleEnum.DIRECTOR ||
    role === UserRoleEnum.MANAGER ||
    role === UserRoleEnum.OFFICER
  );
}

/** Operational roles must have an active commercial line before posting or scoped reads. */
export function roleRequiresCommercialServiceAssignment(role: UserRole): boolean {
  return !roleSeesAllCommercialServices(role);
}

export function resolveServiceScope(session: AuthSession): ServiceScope {
  if (roleSeesAllCommercialServices(session.role)) {
    return { mode: "all" };
  }
  const id = session.commercialService?.id?.trim();
  if (id) return { mode: "single", commercialServiceId: id };
  return { mode: "none" };
}

const NO_COMMERCIAL_LINE_MSG =
  "No commercial line is assigned to your account. Ask an administrator to assign one.";

/** Block creates/updates when an operational user has no line. */
export function commercialServiceErrorForOperations(scope: ServiceScope): string | null {
  if (scope.mode === "none") return NO_COMMERCIAL_LINE_MSG;
  return null;
}

/** For reads and mutations on an existing document. */
export function commercialServiceErrorForResource(
  scope: ServiceScope,
  resourceCommercialServiceId: string | null | undefined,
): string | null {
  const opErr = commercialServiceErrorForOperations(scope);
  if (opErr) return opErr;
  if (scope.mode === "all") return null;
  const rid = resourceCommercialServiceId?.trim() ?? null;
  if (!rid) {
    return "This document is not tied to a commercial line you can access.";
  }
  if (scope.mode !== "single") return null;
  if (rid !== scope.commercialServiceId) {
    return "This document belongs to another commercial line.";
  }
  return null;
}

const EMPTY_COMMERCIAL_SERVICE_FILTER = { commercialServiceId: { in: [] as string[] } };

export function saleWhereForScope(scope: ServiceScope): Prisma.SaleWhereInput | undefined {
  if (scope.mode === "all") return undefined;
  if (scope.mode === "none") return EMPTY_COMMERCIAL_SERVICE_FILTER;
  return { commercialServiceId: scope.commercialServiceId };
}

export function deliveryOrderWhereForScope(
  scope: ServiceScope,
): Prisma.DeliveryOrderWhereInput | undefined {
  if (scope.mode === "all") return undefined;
  if (scope.mode === "none") return EMPTY_COMMERCIAL_SERVICE_FILTER;
  return { commercialServiceId: scope.commercialServiceId };
}

const EMPTY_CUSTOMER_FILTER = { commercialServiceId: { in: [] as string[] } };

export function customerWhereForScope(
  scope: ServiceScope,
): Prisma.CustomerWhereInput | undefined {
  if (scope.mode === "all") return undefined;
  if (scope.mode === "none") return EMPTY_CUSTOMER_FILTER;
  return { commercialServiceId: scope.commercialServiceId };
}

/** Shared regimes (null) plus regimes tagged to this commercial line. */
export function taxRegimeWhereForCommercialLine(
  commercialServiceId: string,
): Prisma.TaxRegimeWhereInput {
  return {
    OR: [{ commercialServiceId: null }, { commercialServiceId }],
  };
}

export function mergeWhereWithCustomerScope<W extends Prisma.CustomerWhereInput>(
  base: W,
  scope: ServiceScope,
): W {
  const extra = customerWhereForScope(scope);
  if (!extra) return base;
  return { AND: [base, extra] } as W;
}

export function mergeWhereWithServiceScope<W extends Prisma.SaleWhereInput>(
  base: W,
  scope: ServiceScope,
  whereForScope: (s: ServiceScope) => Prisma.SaleWhereInput | undefined = saleWhereForScope,
): W {
  const extra = whereForScope(scope);
  if (!extra) return base;
  return { AND: [base, extra] } as W;
}

/**
 * Product picker filter for a commercial line.
 * Products with no `commercialServiceId` remain shared across lines until tagged in Setup.
 */
export function productWhereForScope(
  scope: ServiceScope,
  base: Prisma.ProductWhereInput = {},
): Prisma.ProductWhereInput {
  if (scope.mode === "all") return base;
  if (scope.mode === "none") {
    return { AND: [base, { productId: { in: [] } }] };
  }
  return {
    AND: [
      base,
      {
        OR: [
          { commercialServiceId: null },
          { commercialServiceId: scope.commercialServiceId },
        ],
      },
    ],
  };
}

/** Stable service code keys used for legacy BPO vs bulk product split when SKUs are untagged. */
export function productCatalogHintWhereForServiceCode(
  code: string,
): Prisma.ProductWhereInput | undefined {
  const normalized = code.trim().toLowerCase();
  if (
    normalized.includes("bpo") ||
    normalized === "bottled-palm-oil" ||
    normalized === "bottled_palm_oil"
  ) {
    return { productCat: { isBottled: true } };
  }
  if (
    normalized.includes("rubber") ||
    normalized === "default" ||
    normalized.includes("palm")
  ) {
    return { productCat: { isBottled: false } };
  }
  return undefined;
}
