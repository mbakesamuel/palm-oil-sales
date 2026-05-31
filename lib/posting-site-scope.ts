import type { CommercialSiteKind } from "@/lib/domain-commercial";
import type { AuthSession } from "@/lib/auth-session";
import { actorRequiresFixedPostingSite } from "@/lib/sales-point-assignment";
import type { UserRole } from "@/lib/domain";
import { resolveCommercialProfile, siteLabelForKind } from "@/lib/commercial-profile";

export type ActorPostingSiteRow = {
  role: string;
  globalRoleDefinitionId?: string | null;
  requiresFixedPostingSite?: boolean | null;
  salesPointId: number | null;
  factoryId: string | null;
  isActive: boolean;
};

export type PostingSiteContext = {
  siteKind: CommercialSiteKind;
  siteLabel: "Sales point" | "Factory";
  salesPointId: number | null;
  factoryId: string | null;
};

export function postingSiteFromSession(session: AuthSession): PostingSiteContext {
  const profile = resolveCommercialProfile(session);
  const siteKind = profile?.siteKind ?? "SALES_POINT";
  return {
    siteKind,
    siteLabel: siteLabelForKind(siteKind),
    salesPointId: session.salesPoint?.id ?? null,
    factoryId: session.factory?.id ?? null,
  };
}

/** For creates/updates: submitted site must match assignment for the actor's line. */
export function postingSiteErrorForSubmitted(
  actor: ActorPostingSiteRow,
  siteKind: CommercialSiteKind,
  submittedSalesPointId: number | null,
  submittedFactoryId: string | null,
): string | null {
  if (!actor.isActive) return "Your account is inactive.";
  if (
    !actorRequiresFixedPostingSite({
      role: actor.role as UserRole,
      globalRoleDefinitionId: actor.globalRoleDefinitionId,
      requiresFixedPostingSite: actor.requiresFixedPostingSite,
    })
  ) {
    return null;
  }

  if (siteKind === "FACTORY") {
    if (!actor.factoryId) {
      return `Your account has no ${siteLabelForKind("FACTORY").toLowerCase()} assigned. Ask an administrator.`;
    }
    if (!submittedFactoryId) {
      return `${siteLabelForKind("FACTORY")} is required for your role.`;
    }
    if (submittedFactoryId !== actor.factoryId) {
      return `You can only operate at your assigned ${siteLabelForKind("FACTORY").toLowerCase()}.`;
    }
    return null;
  }

  if (!actor.salesPointId) {
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

/** For reads/mutations on an existing document tied to a sales point (palm workflows). */
export function salesPointErrorForResource(
  actor: ActorPostingSiteRow,
  resourceSalesPointId: number | null,
): string | null {
  if (!actor.isActive) return "Your account is inactive.";
  if (
    !actorRequiresFixedPostingSite({
      role: actor.role as UserRole,
      globalRoleDefinitionId: actor.globalRoleDefinitionId,
      requiresFixedPostingSite: actor.requiresFixedPostingSite,
    })
  ) {
    return null;
  }
  if (actor.factoryId && !actor.salesPointId) {
    return "This document is tied to a sales point, not your factory line.";
  }
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
