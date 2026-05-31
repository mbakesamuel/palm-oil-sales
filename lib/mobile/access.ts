import type { AuthSession } from "@/lib/auth-session";
import { getPermissionsForSession } from "@/lib/access-control";

/** True when the role definition grants mobile API access (DB permission). */
export async function canUseMobileApp(session: AuthSession): Promise<boolean> {
  const perms = await getPermissionsForSession(session);
  return perms["route:/api/mobile/v1"] === true;
}
