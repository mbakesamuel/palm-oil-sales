import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { resolveMobileValidateConsignmentPermission } from "@/lib/api/mobile/resolve-mobile-permission";
import { validateConsignmentForSession } from "@/lib/services/mobile-consignment-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return withMobileAuth(
    request,
    resolveMobileValidateConsignmentPermission(),
    async ({ session }) => {
      const result = await validateConsignmentForSession(session, id);
      if (!result.ok) {
        return mobileError(result.error, 400);
      }
      return mobileJson({ ok: true });
    },
  );
}
