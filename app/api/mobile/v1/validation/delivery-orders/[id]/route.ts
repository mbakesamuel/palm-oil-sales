import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { resolveMobileValidateDeliveryOrderPermission } from "@/lib/api/mobile/resolve-mobile-permission";
import { loadDeliveryOrderDetailForSession } from "@/lib/services/do-validation-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return mobileError("Invalid delivery order.", 400);
  }

  return withMobileAuth(
    request,
    resolveMobileValidateDeliveryOrderPermission(),
    async ({ session }) => {
      const detail = await loadDeliveryOrderDetailForSession(session, numericId);
      if (!detail) {
        return mobileError("Delivery order not found or not visible.", 404);
      }
      return mobileJson({ detail });
    },
  );
}
