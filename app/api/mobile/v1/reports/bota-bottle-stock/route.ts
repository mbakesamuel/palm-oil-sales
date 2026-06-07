import { mobileError, mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { loadBotaBottleStockReport } from "@/app/(app)/reports/(stock)/bota-bottle-stock/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DENIED_MESSAGES = {
  "not-configured": "Bota sales point is not configured on this server.",
  "bota-only": "This ledger is restricted to staff assigned to the Bota sales point.",
  "no-sales-point":
    "Your role requires a sales point assignment. Ask an administrator to assign you to Bota.",
} as const;

export async function GET(request: Request) {
  return withMobileAuth(request, "route:/reports/bota-bottle-stock", async ({ session }) => {
    const url = new URL(request.url);
    const data = await loadBotaBottleStockReport(session, {
      productId: url.searchParams.get("productId") ?? undefined,
    });

    if ("type" in data) {
      return mobileError(DENIED_MESSAGES[data.type], 403);
    }

    return mobileJson(data);
  });
}
