import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { getTransferDetailForSession } from "@/lib/services/mobile-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const url = new URL(request.url);
  const forReceive = url.searchParams.get("forReceive") === "1";

  return withMobileAuth(request, "route:/stock", async ({ session }) => {
    const detail = await getTransferDetailForSession(session, id, { forReceive });
    if (!detail) {
      return mobileError("Transfer not found or not visible.", 404);
    }
    return mobileJson({ detail });
  });
}
