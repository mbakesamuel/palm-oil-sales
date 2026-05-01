import type { PrismaClient } from "@prisma/client";
import type { UserRole } from "@prisma/client";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";

export type ActorSalesPointRow = {
  role: UserRole;
  salesPointId: number | null;
  isActive: boolean;
};

export async function fetchActorSalesPointScope(
  prisma: PrismaClient,
  userId: string,
): Promise<ActorSalesPointRow | null> {
  const id = String(userId ?? "").trim();
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { role: true, salesPointId: true, isActive: true },
  });
}

/** For creates/updates: submitted sales point must match the actor's assignment when their role requires one. */
export function salesPointErrorForSubmitted(
  actor: ActorSalesPointRow,
  submittedSalesPointId: number | null,
): string | null {
  if (!actor.isActive) return "Your account is inactive.";
  if (!roleRequiresSalesPoint(actor.role)) return null;
  if (actor.salesPointId == null) {
    return "Your account has no sales point assigned. Ask an administrator.";
  }
  if (submittedSalesPointId == null) {
    return "Sales point is required for your role.";
  }
  if (submittedSalesPointId !== actor.salesPointId) {
    return "You can only operate at your assigned sales point.";
  }
  return null;
}

/** For reads and mutations on an existing document: document sales point must match when the actor's role requires one. */
export function salesPointErrorForResource(
  actor: ActorSalesPointRow,
  resourceSalesPointId: number | null,
): string | null {
  if (!actor.isActive) return "Your account is inactive.";
  if (!roleRequiresSalesPoint(actor.role)) return null;
  if (actor.salesPointId == null) {
    return "Your account has no sales point assigned. Ask an administrator.";
  }
  if (resourceSalesPointId == null) {
    return "This document is not tied to a sales point you can access.";
  }
  if (resourceSalesPointId !== actor.salesPointId) {
    return "This document belongs to another sales point.";
  }
  return null;
}
