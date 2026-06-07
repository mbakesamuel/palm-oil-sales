import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { loadConsignmentDetailForSession } from "@/lib/services/mobile-consignment-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return withMobileAuth(request, "route:/consignment-notes", async ({ session }) => {
    const detail = await loadConsignmentDetailForSession(session, id);
    if (!detail) {
      return mobileError("Consignment note not found or not visible.", 404);
    }
    return mobileJson({ detail });
  });
}
