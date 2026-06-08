import { mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { resolveMobileValidateSalePermission } from "@/lib/api/mobile/resolve-mobile-permission";
import { listPendingConsignmentNotesForSession } from "@/lib/services/mobile-consignment-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(
    request,
    resolveMobileValidateSalePermission(),
    async ({ session }) => {
      const rows = await listPendingConsignmentNotesForSession(session);
      return mobileJson({ rows });
    },
  );
}
