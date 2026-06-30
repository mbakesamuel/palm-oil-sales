import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { lookupDeliveryOrderForSession } from "@/lib/services/pos-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/pos", async ({ session }) => {
    try {
      const url = new URL(request.url);
      const no = url.searchParams.get("no") ?? "";
      const customerId = url.searchParams.get("customerId") ?? "";
      const result = await lookupDeliveryOrderForSession(session, no, customerId);
      if (!result.ok) {
        return mobileError(result.error, 400);
      }
      return mobileJson(result);
    } catch (e) {
      return mobileError(
        e instanceof Error ? e.message : "Could not look up delivery order.",
        403,
      );
    }
  });
}
