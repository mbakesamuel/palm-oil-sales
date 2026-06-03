import { mobileError, mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { resolveMobileValidateDeliveryOrderPermission } from "@/lib/api/mobile/resolve-mobile-permission";
import { validateReviewedDeliveryOrdersForSession } from "@/lib/services/do-validation-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withMobileAuth(
    request,
    resolveMobileValidateDeliveryOrderPermission(),
    async ({ session }) => {
      let body: { ids?: number[] };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return mobileError("Invalid JSON body.", 400);
      }

      const result = await validateReviewedDeliveryOrdersForSession(session, {
        ids: body.ids ?? [],
      });
      if (!result.ok) {
        return mobileError(result.error, 400);
      }
      return mobileJson(result);
    },
  );
}
