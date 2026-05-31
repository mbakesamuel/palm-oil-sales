import { mobileError, mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { listPendingDeliveryOrdersForSession } from "@/lib/services/do-validation-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(
    request,
    "route:/delivery-orders/validation-queue",
    async ({ session }) => {
      const url = new URL(request.url);
      try {
        const data = await listPendingDeliveryOrdersForSession(session, {
          pageSize: Number(url.searchParams.get("pageSize") ?? "50") || 50,
          filters: {
            q: url.searchParams.get("q"),
            from: url.searchParams.get("from"),
            to: url.searchParams.get("to"),
            reviewed:
              (url.searchParams.get("reviewed") as "only" | "exclude" | "all" | null) ??
              "all",
            salesPointId: url.searchParams.get("salesPointId")
              ? Number(url.searchParams.get("salesPointId"))
              : null,
          },
        });
        return mobileJson(data);
      } catch (e) {
        return mobileError(e instanceof Error ? e.message : "Failed.", 403);
      }
    },
  );
}
