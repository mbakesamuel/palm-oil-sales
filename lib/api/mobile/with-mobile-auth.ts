import "server-only";

import { NextResponse } from "next/server";
import type { AuthSession } from "@/lib/auth-session";
import {
  assertPermissionKeyForSession,
  getPermissionsForSession,
} from "@/lib/access-control";
import type { PermissionKey } from "@/lib/access-control-keys";
import { serializeForMobile } from "@/lib/api/mobile/serialize";
import { effectiveSessionRole } from "@/lib/auth-roles";
import { sessionRoleLabel } from "@/lib/auth-display";
import { loadAuthSessionByUserId } from "@/lib/load-auth-session";
import { verifyMobileAccessToken } from "@/lib/mobile/tokens";

export const MOBILE_JSON_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "application/json",
} as const;

export function mobileJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(serializeForMobile(data), {
    status,
    headers: MOBILE_JSON_HEADERS,
  });
}

export function mobileError(message: string, status: number): NextResponse {
  return mobileJson({ error: message }, status);
}

export async function getMobileSessionFromRequest(
  request: Request,
): Promise<AuthSession | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  if (!token) return null;

  const verified = await verifyMobileAccessToken(token);
  if (!verified) return null;

  return loadAuthSessionByUserId(verified.userId);
}

type MobileHandlerContext = {
  session: AuthSession;
  permissions: Awaited<ReturnType<typeof getPermissionsForSession>>;
};

type MobileHandler = (ctx: MobileHandlerContext) => Promise<NextResponse>;

export async function withMobileAuth(
  request: Request,
  permissionKey: PermissionKey | null,
  handler: MobileHandler,
): Promise<NextResponse> {
  const session = await getMobileSessionFromRequest(request);
  if (!session) {
    return mobileError("Unauthorized.", 401);
  }

  try {
    if (permissionKey) {
      await assertPermissionKeyForSession(session, permissionKey);
    }
  } catch (e) {
    return mobileError(
      e instanceof Error ? e.message : "Forbidden.",
      403,
    );
  }

  const permissions = await getPermissionsForSession(session);
  return handler({ session, permissions });
}

export function toMobileSessionPayload(
  session: AuthSession,
  permissions: Awaited<ReturnType<typeof getPermissionsForSession>>,
) {
  const allowedRoutes = Object.entries(permissions)
    .filter(([, allowed]) => allowed)
    .map(([key]) => key);

  const workflowRole = effectiveSessionRole(session);

  return {
    session: {
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      role: workflowRole,
      roleLabel: sessionRoleLabel({ ...session, role: workflowRole }),
      globalRole: session.globalRole,
      salesPoint: session.salesPoint,
      factory: session.factory,
      service: session.service,
      commercialService: session.commercialService,
      commercialServiceRole: session.commercialServiceRole,
    },
    permissions: allowedRoutes,
  };
}
