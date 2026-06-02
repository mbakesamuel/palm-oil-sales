import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { listDraftReceiptsForSession } from "@/lib/services/mobile-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/stock", async ({ session }) => {
    try {
      const rows = await listDraftReceiptsForSession(session);
      return mobileJson({ rows });
    } catch (e) {
      return mobileError(
        e instanceof Error ? e.message : "Could not load receipts.",
        403,
      );
    }
  });
}
