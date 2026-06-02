import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { getReceiptDetailForSession } from "@/lib/services/mobile-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return withMobileAuth(request, "route:/stock", async ({ session }) => {
    const detail = await getReceiptDetailForSession(session, id);
    if (!detail) {
      return mobileError("Receipt not found or not visible.", 404);
    }
    return mobileJson({ detail });
  });
}
