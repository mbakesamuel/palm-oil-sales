import "server-only";

import type { PrismaClient } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { UserRole } from "@/lib/domain";
import {
  commercialServiceErrorForResource,
  resolveServiceScope,
  type ServiceScope,
} from "@/lib/service-scope";

/** Only administrators may tag products as shared or assign another commercial line. */
export function canPickProductCommercialLine(role: string | undefined): boolean {
  return role === UserRole.ADMIN;
}

export function productCommercialServiceIdForCreate(
  isAdmin: boolean,
  assignedLineId: string | null,
  formCommercialServiceId: string,
): string | null {
  if (!isAdmin) {
    if (!assignedLineId) {
      throw new Error(
        "No commercial line is assigned to your account. Ask an administrator.",
      );
    }
    return assignedLineId;
  }
  const id = formCommercialServiceId.trim();
  return id.length ? id : null;
}

export function productCommercialServiceIdForUpdate(
  isAdmin: boolean,
  existingCommercialServiceId: string | null,
  formCommercialServiceId: string,
): string | null {
  if (!isAdmin) return existingCommercialServiceId;
  const id = formCommercialServiceId.trim();
  return id.length ? id : null;
}

export function commercialServiceErrorForProduct(
  scope: ServiceScope,
  productCommercialServiceId: string | null | undefined,
): string | null {
  return commercialServiceErrorForResource(scope, productCommercialServiceId);
}

export async function assertProductAccessible(
  prisma: PrismaClient,
  session: AuthSession,
  productId: number,
): Promise<{ commercialServiceId: string | null }> {
  const scope = resolveServiceScope(session);
  const product = await prisma.product.findUnique({
    where: { productId },
    select: { commercialServiceId: true },
  });
  if (!product) throw new Error("Product not found.");
  const err = commercialServiceErrorForProduct(scope, product.commercialServiceId);
  if (err) throw new Error(err);
  return product;
}
