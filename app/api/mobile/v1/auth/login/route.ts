import { authenticateMobileUser } from "@/lib/mobile/auth-service";
import {
  mobileError,
  mobileJson,
  toMobileSessionPayload,
} from "@/lib/api/mobile/with-mobile-auth";
import { getPermissionsForSession } from "@/lib/access-control";
import {
  databaseUnavailableMessage,
  isDatabaseUnavailableError,
  prismaRetry,
} from "@/lib/prisma-retry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: { username?: string; password?: string; deviceLabel?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return mobileError("Invalid JSON body.", 400);
    }

    const result = await authenticateMobileUser(
      String(body.username ?? ""),
      String(body.password ?? ""),
      body.deviceLabel,
    );

    if (!result.ok) {
      return mobileError(result.error, 401);
    }

    const permissions = await prismaRetry(
      () => getPermissionsForSession(result.session),
      { retries: 3, baseDelayMs: 300 },
    );

    return mobileJson({
      ...toMobileSessionPayload(result.session, permissions),
      tokens: result.tokens,
    });
  } catch (e) {
    console.error("[mobile/auth/login]", e);
    if (isDatabaseUnavailableError(e)) {
      return mobileError(databaseUnavailableMessage(), 503);
    }
    return mobileError(
      e instanceof Error ? e.message : "Login failed.",
      500,
    );
  }
}
