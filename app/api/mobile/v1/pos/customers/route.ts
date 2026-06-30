import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { searchCustomersForSession } from "@/lib/services/pos-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/pos", async ({ session }) => {
    try {
      const url = new URL(request.url);
      const q = url.searchParams.get("q") ?? "";
      const rows = await searchCustomersForSession(session, q);
      return mobileJson({ rows });
    } catch (e) {
      return mobileError(
        e instanceof Error ? e.message : "Could not load customers.",
        403,
      );
    }
  });
}
