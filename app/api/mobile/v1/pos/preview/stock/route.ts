import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { previewPosLineStockForSession } from "@/lib/services/pos-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withMobileAuth(request, "route:/pos", async ({ session }) => {
    try {
      const body = (await request.json()) as {
        salesPointId?: number;
        storageLocationId?: number;
        productId?: number;
      };
      const result = await previewPosLineStockForSession(
        session,
        Number(body.salesPointId),
        Number(body.storageLocationId),
        Number(body.productId),
      );
      if (!result.ok) {
        return mobileError(result.error, 400);
      }
      return mobileJson(result);
    } catch (e) {
      return mobileError(
        e instanceof Error ? e.message : "Could not preview stock.",
        403,
      );
    }
  });
}
