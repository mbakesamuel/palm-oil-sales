import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { loadSaleDetailForSession } from "@/lib/services/mobile-pending-sales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return withMobileAuth(request, "route:/pos", async ({ session }) => {
    const detail = await loadSaleDetailForSession(session, id);
    if (!detail) {
      return mobileError("Sale not found or not visible.", 404);
    }
    return mobileJson({ detail });
  });
}
