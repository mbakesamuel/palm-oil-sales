import type { AuthSession } from "@/lib/auth-session";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import type { UserRole } from "@/lib/domain";

/** Default for new line roles: infer from the stable role code. */
export function defaultRequiresFixedPostingSiteForRoleCode(code: string): boolean {
  const c = String(code ?? "")
    .trim()
    .toLowerCase();

  if (c.includes("senior") && c.includes("supervisor")) return false;
  // Line/site managers roam; factory managers stay on one factory.
  if (c.includes("manager") && !c.includes("factory")) return false;

  return true;
}

export type PostingSiteAssignmentContext = {
  role: UserRole;
  /** Set when the user has an org-wide global role (always posting-site exempt). */
  globalRole?: AuthSession["globalRole"] | null;
  /** Line role metadata when assigned. */
  commercialServiceRole?: Pick<
    NonNullable<AuthSession["commercialServiceRole"]>,
    "code" | "requiresFixedPostingSite"
  > | null;
};

/** Whether the user must be assigned to one sales point (or factory on factory lines). */
export function userRequiresFixedPostingSite(ctx: PostingSiteAssignmentContext): boolean {
  if (ctx.globalRole) return false;
  const lineRole = ctx.commercialServiceRole;
  if (lineRole) {
    if (lineRole.requiresFixedPostingSite != null) {
      return lineRole.requiresFixedPostingSite;
    }
    if (lineRole.code) {
      return defaultRequiresFixedPostingSiteForRoleCode(lineRole.code);
    }
  }
  return roleRequiresSalesPoint(ctx.role);
}

export function sessionRequiresFixedPostingSite(
  session: Pick<AuthSession, "role" | "globalRole" | "commercialServiceRole">,
): boolean {
  return userRequiresFixedPostingSite({
    role: session.role,
    globalRole: session.globalRole,
    commercialServiceRole: session.commercialServiceRole,
  });
}

export type ActorPostingSiteAssignmentRow = {
  role: UserRole;
  /** Ignored when `commercialServiceRoleCode` is set (line staff). */
  globalRoleDefinitionId?: string | null;
  commercialServiceRoleCode?: string | null;
  requiresFixedPostingSite?: boolean | null;
};

export function actorRequiresFixedPostingSite(actor: ActorPostingSiteAssignmentRow): boolean {
  const lineCode = actor.commercialServiceRoleCode?.trim();
  if (lineCode) {
    if (actor.requiresFixedPostingSite != null) {
      return actor.requiresFixedPostingSite;
    }
    return defaultRequiresFixedPostingSiteForRoleCode(lineCode);
  }
  if (actor.globalRoleDefinitionId) return false;
  return roleRequiresSalesPoint(actor.role);
}

/** Sales point filter for list/report queries when the session is site-scoped. */
export function scopedSalesPointIdFromSession(
  session: Pick<AuthSession, "role" | "globalRole" | "commercialServiceRole" | "salesPoint">,
): number | null {
  if (!sessionRequiresFixedPostingSite(session)) return null;
  return session.salesPoint?.id ?? null;
}

export type DashboardDataScope = {
  /** Set when the session is limited to one sales point; null = all sales points. */
  salesPointId: number | null;
  scopeHint: string;
  missingRequiredSalesPoint: boolean;
};

const NO_SALES_POINT_MSG =
  "No sales point is assigned to your account. Ask an administrator to assign one.";

/** Chart/KPI scope for dashboard loaders: site-scoped roles vs global / roaming roles. */
export function resolveDashboardDataScope(
  session: Pick<AuthSession, "role" | "globalRole" | "commercialServiceRole" | "salesPoint">,
): DashboardDataScope {
  const salesPointId = scopedSalesPointIdFromSession(session);
  const scopeHint =
    salesPointId != null
      ? (session.salesPoint?.name ?? "Your sales point")
      : "All sales points";
  const missingRequiredSalesPoint =
    sessionRequiresFixedPostingSite(session) && salesPointId == null;
  return { salesPointId, scopeHint, missingRequiredSalesPoint };
}

export { NO_SALES_POINT_MSG };
