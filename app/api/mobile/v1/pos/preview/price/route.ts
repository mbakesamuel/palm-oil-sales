import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { previewPosUnitPriceForSession } from "@/lib/services/pos-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withMobileAuth(request, "route:/pos", async ({ session }) => {
    try {
      const body = (await request.json()) as {
        customerId?: string;
        productId?: number;
        transactionIso?: string;
        isBottle?: boolean;
        disposition?: string;
      };
      const result = await previewPosUnitPriceForSession(session, {
        customerId: body.customerId,
        productId: Number(body.productId),
        transactionIso: String(body.transactionIso ?? ""),
        isBottle: Boolean(body.isBottle),
        disposition: String(body.disposition ?? "NORMAL"),
      });
      if (!result.ok) {
        return mobileError(result.error, 400);
      }
      return mobileJson(result);
    } catch (e) {
      return mobileError(
        e instanceof Error ? e.message : "Could not preview price.",
        403,
      );
    }
  });
}
