import "server-only";

import type { AuthSession } from "@/lib/auth-session";
import type { UserRole } from "@/lib/domain";
import { profileFromCommercialService } from "@/lib/commercial-profile";
import { getPrismaClient } from "@/lib/prisma";
import { roleRequiresCommercialServiceAssignment } from "@/lib/auth-roles";
import {
  defaultRequiresFixedPostingSiteForRoleCode,
  userRequiresFixedPostingSite,
} from "@/lib/sales-point-assignment";
import { PERMISSION_KEYS } from "@/lib/access-control-keys";
import { snapshotForLineRoleCode } from "@/lib/permission-seed-snapshot";
const userSessionInclude = {
  salesPoint: { select: { id: true, name: true } },
  factory: { select: { id: true, name: true } },
  commercialService: {
    select: {
      id: true,
      code: true,
      name: true,
      invoicePrefix: true,
      isActive: true,
      siteKind: true,
      enabledModules: true,
    },
  },
  commercialServiceRole: {
    select: { id: true, code: true, name: true, isActive: true, requiresFixedPostingSite: true },
  },
  globalRoleDefinition: {
    select: { id: true, code: true, displayName: true, isActive: true, legacyRole: true },
  },
} as const;

function mapUserToAuthSession(user: {
  id: string;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  service: string | null;
  salesPoint: { id: number; name: string } | null;
  factory: { id: string; name: string } | null;
  commercialService: {
    id: string;
    code: string;
    name: string;
    invoicePrefix: string;
    isActive: boolean;
    siteKind: "SALES_POINT" | "FACTORY";
    enabledModules: unknown;
  } | null;
  commercialServiceRole: {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    requiresFixedPostingSite: boolean;
  } | null;
  globalRoleDefinition: {
    id: string;
    code: string;
    displayName: string;
    isActive: boolean;
    legacyRole: string | null;
  } | null;
}): AuthSession | null {
  if (!user.isActive) return null;

  // Resolve global role metadata and effective UserRole without reassignment.
  const salesPoint =
    user.salesPoint != null ? { id: user.salesPoint.id, name: user.salesPoint.name } : null;
  const factory =
    user.factory != null ? { id: user.factory.id, name: user.factory.name } : null;
  const service =
    typeof user.service === "string" && user.service.trim() !== "" ? user.service.trim() : null;

  let commercialService: AuthSession["commercialService"] = null;
  if (user.commercialService?.isActive === true) {
    const profile = profileFromCommercialService(user.commercialService);
    commercialService = {
      id: profile.commercialServiceId,
      code: profile.code,
      name: profile.name,
      invoicePrefix: user.commercialService.invoicePrefix,
      siteKind: profile.siteKind,
      enabledModules: profile.enabledModules,
    };
  }

  let commercialServiceRole: AuthSession["commercialServiceRole"] = null;
  if (user.commercialServiceRole?.isActive === true) {
    commercialServiceRole = {
      id: user.commercialServiceRole.id,
      code: user.commercialServiceRole.code,
      name: user.commercialServiceRole.name,
      requiresFixedPostingSite: user.commercialServiceRole.requiresFixedPostingSite,
    };
  }

  const globalRoleDef = user.globalRoleDefinition;
  // Line staff must not inherit a stale org-wide global role (e.g. Senior sales supervisor)
  // that was assigned before line roles were exclusive. Org-wide metadata only when there
  // is no active commercial line role.
  const globalRole: AuthSession["globalRole"] =
    commercialServiceRole || !globalRoleDef?.isActive
      ? null
      : {
          id: globalRoleDef.id,
          code: globalRoleDef.code,
          displayName: globalRoleDef.displayName,
        };

  const role: UserRole =
    commercialServiceRole != null
      ? (user.role as UserRole)
      : globalRoleDef?.isActive === true && globalRoleDef.legacyRole
        ? (globalRoleDef.legacyRole as UserRole)
        : (user.role as UserRole);

  if (!validateUserAssignment(role, globalRole, commercialService, commercialServiceRole, salesPoint, factory)) {
    return null;
  }

  return {
    userId: user.id,
    username: user.username,
    displayName: user.name,
    role,
    globalRole,
    salesPoint,
    factory,
    service,
    commercialService,
    commercialServiceRole,
  };
}

function validateUserAssignment(
  role: UserRole,
  globalRole: AuthSession["globalRole"],
  commercialService: AuthSession["commercialService"],
  commercialServiceRole: AuthSession["commercialServiceRole"],
  salesPoint: AuthSession["salesPoint"],
  factory: AuthSession["factory"],
): boolean {
  if (roleRequiresCommercialServiceAssignment(role)) {
    if (!commercialService) return false;
  }

  if (!userRequiresFixedPostingSite({ role, globalRole, commercialServiceRole })) {
    return true;
  }

  if (commercialService) {
    if (commercialService.siteKind === "FACTORY") {
      if (!factory) return false;
    } else if (!salesPoint) {
      return false;
    }
  } else if (!salesPoint) {
    return false;
  }

  return true;
}

export function mapAuthSessionToToken(session: AuthSession) {
  return {
    sub: session.userId,
    userId: session.userId,
    role: session.role,
    username: session.username,
    displayName: session.displayName,
    salesPoint: session.salesPoint,
    factory: session.factory ?? null,
    service: session.service ?? null,
    commercialService: session.commercialService ?? null,
    commercialServiceRole: session.commercialServiceRole ?? null,
    globalRole: session.globalRole ?? null,
  };
}

export async function loadAuthSessionByUserId(
  userId: string,
): Promise<AuthSession | null> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userSessionInclude,
  });
  if (!user) return null;
  return mapUserToAuthSession(user);
}

export async function loadAuthSessionByUsername(
  username: string,
): Promise<AuthSession | null> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { username },
    include: userSessionInclude,
  });
  if (!user) return null;
  return mapUserToAuthSession(user);
}

/** Seed default service roles for a commercial line if none exist. */
export async function ensureDefaultServiceRolesForCommercialService(
  commercialServiceId: string,
  siteKind: "SALES_POINT" | "FACTORY",
) {
  const prisma = getPrismaClient();
  const count = await prisma.commercialServiceRole.count({
    where: { commercialServiceId },
  });
  if (count > 0) return;

  const roleTemplates =
    siteKind === "FACTORY"
      ? [
          { code: "factory_clerk", name: "Factory clerk", sortOrder: 10 },
          { code: "factory_supervisor", name: "Factory supervisor", sortOrder: 20 },
          { code: "factory_manager", name: "Factory manager", sortOrder: 30 },
        ]
      : [
          { code: "clerk", name: "Sales clerk", sortOrder: 10 },
          { code: "supervisor", name: "Supervisor", sortOrder: 20 },
          { code: "senior_supervisor", name: "Senior sales supervisor", sortOrder: 30 },
          { code: "manager", name: "Manager", sortOrder: 40 },
        ];

  for (const r of roleTemplates) {
    const created = await prisma.commercialServiceRole.create({
      data: {
        commercialServiceId,
        ...r,
        requiresFixedPostingSite: defaultRequiresFixedPostingSiteForRoleCode(r.code),
      },
    });
    const seed = snapshotForLineRoleCode(created.code);
    await prisma.commercialServiceRolePermission.createMany({
      data: PERMISSION_KEYS.map((key) => ({
        commercialServiceRoleId: created.id,
        key,
        allowed: seed[key],
      })),
      skipDuplicates: true,
    });
  }
}
