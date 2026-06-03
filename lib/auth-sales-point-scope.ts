import type { PrismaClient } from "@prisma/client";
import type { UserRole } from "@prisma/client";
import type { AuthSession } from "@/lib/auth-session";
import { userRoleFromLineRoleCode } from "@/lib/line-role-user-role";
import {
  actorRequiresFixedPostingSite,
  type ActorPostingSiteAssignmentRow,
} from "@/lib/sales-point-assignment";

export type ActorSalesPointRow = ActorPostingSiteAssignmentRow & {
  salesPointId: number | null;
  isActive: boolean;
};

/** Build actor scope from a loaded session (same rules as web). */
export function actorFromAuthSession(session: AuthSession): ActorSalesPointRow {
  const lineRole = session.commercialServiceRole;
  return {
    role: session.role,
    globalRoleDefinitionId: lineRole ? null : (session.globalRole?.id ?? null),
    commercialServiceRoleCode: lineRole?.code ?? null,
    requiresFixedPostingSite: lineRole?.requiresFixedPostingSite ?? null,
    salesPointId: session.salesPoint?.id ?? null,
    isActive: true,
  };
}

export async function fetchActorSalesPointScope(
  prisma: PrismaClient,
  userId: string,
): Promise<ActorSalesPointRow | null> {
  const id = String(userId ?? "").trim();
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      role: true,
      globalRoleDefinitionId: true,
      globalRoleDefinition: { select: { isActive: true } },
      salesPointId: true,
      isActive: true,
      commercialServiceRole: {
        select: { code: true, requiresFixedPostingSite: true, isActive: true },
      },
    },
  });
  if (!user) return null;

  const lineRole =
    user.commercialServiceRole?.isActive === true
      ? user.commercialServiceRole
      : null;

  const role: UserRole = lineRole
    ? userRoleFromLineRoleCode(lineRole.code)
    : user.role;

  const globalRoleDefinitionId =
    lineRole != null
      ? null
      : user.globalRoleDefinition?.isActive === true
        ? user.globalRoleDefinitionId
        : null;

  return {
    role,
    globalRoleDefinitionId,
    commercialServiceRoleCode: lineRole?.code ?? null,
    requiresFixedPostingSite: lineRole?.requiresFixedPostingSite ?? null,
    salesPointId: user.salesPointId,
    isActive: user.isActive,
  };
}

/** For creates/updates: submitted sales point must match the actor's assignment when their role requires one. */
export function salesPointErrorForSubmitted(
  actor: ActorSalesPointRow,
  submittedSalesPointId: number | null,
): string | null {
  if (!actor.isActive) return "Your account is inactive.";
  if (!actorRequiresFixedPostingSite(actor)) return null;
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
  if (!actorRequiresFixedPostingSite(actor)) return null;
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
