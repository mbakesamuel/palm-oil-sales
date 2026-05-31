import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { resolveMobileValidateSalePermission } from "@/lib/api/mobile/resolve-mobile-permission";
import { validateSaleForSession } from "@/lib/services/mobile-pending-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withMobileAuth(
    request,
    resolveMobileValidateSalePermission(),
    async ({ session }) => {
      const result = await validateSaleForSession(session, id);
      if (!result.ok) {
        return mobileError(result.error, 400);
      }
      return mobileJson({ ok: true });
    },
  );
}
