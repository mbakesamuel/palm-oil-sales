import {
  mobileJson,
  toMobileSessionPayload,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/api/mobile/v1", async ({ session, permissions }) =>
    mobileJson(toMobileSessionPayload(session, permissions)),
  );
}
