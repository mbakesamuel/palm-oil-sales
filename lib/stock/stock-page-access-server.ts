import "server-only";

import { getPermissionsForSession } from "@/lib/access-control";
import { getServerSession } from "@/lib/auth-server";
import type { AuthSession } from "@/lib/auth-session";
import { isRouteEnabledByProfile, resolveCommercialProfile } from "@/lib/commercial-profile";
import { roleSeesAllCommercialServices } from "@/lib/service-scope";
import { canAccessStockPage } from "@/lib/stock/stock-page-access";

export async function assertStockPageActionAccess(): Promise<AuthSession> {
  const session = await getServerSession();
  if (!session?.userId) throw new Error("Login required.");
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
  return session;
}

export async function assertFullStockActionAccess(): Promise<AuthSession> {
  return assertStockPageActionAccess();
}
