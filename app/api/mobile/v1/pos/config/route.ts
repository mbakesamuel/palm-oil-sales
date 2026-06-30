import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { loadPosConfigForSession } from "@/lib/services/pos-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/pos", async ({ session }) => {
    try {
      const config = await loadPosConfigForSession(session);
      return mobileJson({ config });
    } catch (e) {
      return mobileError(
        e instanceof Error ? e.message : "Could not load POS config.",
        403,
      );
    }
  });
}
