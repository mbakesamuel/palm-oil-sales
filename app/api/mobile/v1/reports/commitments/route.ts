import { mobileError, mobileJson, withMobileAuth } from "@/lib/api/mobile/with-mobile-auth";
import { loadDoCommitmentCrosstab } from "@/app/(app)/reports/(delivery)/do-commitment-crosstab/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withMobileAuth(
    request,
    "route:/reports/do-commitment-crosstab",
    async ({ session }) => {
      const data = await loadDoCommitmentCrosstab(session);

      if ("type" in data) {
        return mobileError(
          "Your role is tied to a sales point, but none is assigned.",
          403,
        );
      }

      return mobileJson(data);
    },
  );
}
