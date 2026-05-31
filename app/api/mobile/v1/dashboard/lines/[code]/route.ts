import { mobileError, mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { getLineDashboardSummary } from "@/lib/services/dashboard-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  return withMobileAuth(request, "route:/dashboard", async ({ session }) => {
    const result = await getLineDashboardSummary(session, code);
    if ("error" in result) {
      return mobileError(result.error, 403);
    }
    return mobileJson(result);
  });
}
