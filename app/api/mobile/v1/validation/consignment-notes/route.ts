import { mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { listPendingConsignmentNotesForSession } from "@/lib/services/mobile-consignment-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/consignment-notes", async ({ session }) => {
    const rows = await listPendingConsignmentNotesForSession(session);
    return mobileJson({ rows });
  });
}
