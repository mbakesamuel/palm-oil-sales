import {
  mobileJson,
  toMobileSessionPayload,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/dashboard", async ({ session, permissions }) =>
    mobileJson(toMobileSessionPayload(session, permissions)),
  );
}
