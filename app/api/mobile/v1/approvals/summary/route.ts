import { mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { getPendingApprovalsSummaryForSession } from "@/lib/services/mobile-approvals-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, null, async ({ session, permissions }) => {
    const summary = await getPendingApprovalsSummaryForSession(session, permissions);
    return mobileJson(summary);
  });
}
