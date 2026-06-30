import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import type { CreateSaleInput } from "@/lib/services/pos-sales";
import { createAndValidateSaleForSession } from "@/lib/services/pos-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withMobileAuth(request, "route:/pos", async ({ session, permissions }) => {
    if (!permissions["ui:validate-documents"]) {
      return mobileError(
        "You do not have permission to raise and validate sales on mobile.",
        403,
      );
    }

    try {
      const body = (await request.json()) as CreateSaleInput;
      const result = await createAndValidateSaleForSession(session, body);
      if (!result.ok) {
        return mobileJson(result, 400);
      }
      return mobileJson(result);
    } catch (e) {
      return mobileError(
        e instanceof Error ? e.message : "Could not create sale.",
        403,
      );
    }
  });
}
