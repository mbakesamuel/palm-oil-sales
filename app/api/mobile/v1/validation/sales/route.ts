import { mobileError, mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { listPendingSalesForSession } from "@/lib/services/mobile-pending-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/pos", async ({ session }) => {
    const rows = await listPendingSalesForSession(session);
    return mobileJson({ rows });
  });
}
