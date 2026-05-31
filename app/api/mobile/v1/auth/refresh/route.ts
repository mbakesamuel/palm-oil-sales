import { getPermissionsForSession } from "@/lib/access-control";
import {
  mobileError,
  mobileJson,
  toMobileSessionPayload,
} from "@/lib/api/mobile/with-mobile-auth";
import { refreshMobileTokens } from "@/lib/mobile/auth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { refreshToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mobileError("Invalid JSON body.", 400);
  }

  const result = await refreshMobileTokens(String(body.refreshToken ?? ""));
  if (!result.ok) {
    return mobileError(result.error, 401);
  }

  const permissions = await getPermissionsForSession(result.session);
  return mobileJson({
    ...toMobileSessionPayload(result.session, permissions),
    tokens: result.tokens,
  });
}
