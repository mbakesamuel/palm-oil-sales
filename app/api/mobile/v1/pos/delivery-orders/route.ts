import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { listAvailableDeliveryOrdersForSession } from "@/lib/services/pos-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/pos", async ({ session }) => {
    try {
      const url = new URL(request.url);
      const salesPointId = Number.parseInt(
        url.searchParams.get("salesPointId") ?? "",
        10,
      );
      if (!Number.isFinite(salesPointId)) {
        return mobileError("salesPointId is required.", 400);
      }
      const rows = await listAvailableDeliveryOrdersForSession(session, salesPointId);
      return mobileJson({ rows });
    } catch (e) {
      return mobileError(
        e instanceof Error ? e.message : "Could not load delivery orders.",
        403,
      );
    }
  });
}
