import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { listTransfersForSession } from "@/lib/services/mobile-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "receive" ? "receive" : "dispatch";

  return withMobileAuth(request, "route:/stock", async ({ session }) => {
    try {
      const rows = await listTransfersForSession(session, mode);
      return mobileJson({ rows, mode });
    } catch (e) {
      return mobileError(
        e instanceof Error ? e.message : "Could not load transfers.",
        403,
      );
    }
  });
}
