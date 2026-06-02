import {
  mobileError,
  mobileJson,
  withMobileAuth,
} from "@/lib/api/mobile/with-mobile-auth";
import { receiveTransferForSession } from "@/lib/services/mobile-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  let receiveLines: Array<{ lineId: string; toStorageLocationId: number }> | undefined;
  try {
    const body = (await request.json()) as {
      lines?: Array<{ lineId: string; toStorageLocationId: number }>;
    };
    if (Array.isArray(body.lines) && body.lines.length > 0) {
      receiveLines = body.lines;
    }
  } catch {
    receiveLines = undefined;
  }

  return withMobileAuth(request, "route:/stock", async ({ session }) => {
    const result = await receiveTransferForSession(session, id, receiveLines);
    if (!result.ok) {
      return mobileError(result.error, 400);
    }
    return mobileJson({ ok: true });
  });
}
