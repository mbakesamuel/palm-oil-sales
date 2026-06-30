import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { previewPosTaxesForSession } from "@/lib/services/pos-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withMobileAuth(request, "route:/pos", async ({ session }) => {
    try {
      const body = (await request.json()) as {
        customerId?: string;
        transactionIso?: string;
      };
      const result = await previewPosTaxesForSession(
        session,
        String(body.customerId ?? ""),
        String(body.transactionIso ?? ""),
      );
      if (!result.ok) {
        return mobileError(result.error, 400);
      }
      return mobileJson(result);
    } catch (e) {
      return mobileError(
        e instanceof Error ? e.message : "Could not preview taxes.",
        403,
      );
    }
  });
}
