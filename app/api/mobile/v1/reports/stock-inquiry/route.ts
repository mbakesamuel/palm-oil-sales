import { mobileError, mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { loadStockInquiryReport } from "@/app/(app)/reports/(stock)/stock-inquiry/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/reports/stock-inquiry", async ({ session }) => {
    const url = new URL(request.url);
    const data = await loadStockInquiryReport(session, {
      productId: url.searchParams.get("productId") ?? undefined,
      locationId: url.searchParams.get("locationId") ?? undefined,
      salesPointId: url.searchParams.get("salesPointId") ?? undefined,
      condition: url.searchParams.get("condition") ?? undefined,
      asAt: url.searchParams.get("asAt") ?? undefined,
    });

    if ("type" in data) {
      return mobileError(
        "Your role is tied to a sales point, but none is assigned.",
        403,
      );
    }

    return mobileJson(data);
  });
}
