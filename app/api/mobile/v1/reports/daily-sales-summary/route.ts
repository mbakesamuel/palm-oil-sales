import { mobileError, mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { loadDailySalesSummary } from "@/app/(app)/reports/(sales)/daily-sales-summary/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(
    request,
    "route:/reports/daily-sales-summary",
    async ({ session }) => {
      const url = new URL(request.url);
      const data = await loadDailySalesSummary(session, {
        date: url.searchParams.get("date"),
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
      });

      return mobileJson(data);
    },
  );
}
