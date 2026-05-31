import { mobileError, mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import {
  canAccessExecutiveDashboardForSession,
  getExecutiveDashboardSummary,
} from "@/lib/services/dashboard-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/dashboard/executive", async ({ session }) => {
    if (!canAccessExecutiveDashboardForSession(session)) {
      return mobileError("Executive dashboard is not available for your role.", 403);
    }
    const data = await getExecutiveDashboardSummary(session);
    return mobileJson(data);
  });
}
