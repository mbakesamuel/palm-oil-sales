import { mobileError, mobileJson } from "@/lib/api/mobile/with-mobile-auth";
import { revokeMobileRefreshToken } from "@/lib/mobile/auth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { refreshToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return mobileError("Invalid JSON body.", 400);
  }

  await revokeMobileRefreshToken(String(body.refreshToken ?? ""));
  return mobileJson({ ok: true });
}
