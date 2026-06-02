import "server-only";

import {
  assertPermissionKeyForSession,
  getPermissionsForSession,
} from "@/lib/access-control";
import type { AuthSession } from "@/lib/auth-session";
import { isRouteEnabledByProfile, resolveCommercialProfile } from "@/lib/commercial-profile";
import { roleSeesAllCommercialServices } from "@/lib/service-scope";
import { canAccessStockPage } from "@/lib/stock/stock-page-access";

export async function assertStockAccessForSession(session: AuthSession): Promise<void> {
  if (!roleSeesAllCommercialServices(session.role)) {
    const profile = resolveCommercialProfile(session);
    if (!isRouteEnabledByProfile(profile, "route:/stock")) {
      throw new Error("This feature is not enabled for your commercial line.");
    }
  }
  const perms = await getPermissionsForSession(session);
  if (!canAccessStockPage(perms)) {
    throw new Error("You do not have permission to access stock.");
  }
}
