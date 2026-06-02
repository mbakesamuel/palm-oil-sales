import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { postReceiptForSession } from "@/lib/services/mobile-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  return withMobileAuth(request, "route:/stock", async ({ session }) => {
    const result = await postReceiptForSession(session, id);
    if (!result.ok) {
      return mobileError(result.error, 400);
    }
    return mobileJson({ ok: true });
  });
}
