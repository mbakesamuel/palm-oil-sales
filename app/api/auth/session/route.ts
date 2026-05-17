import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await auth();
  if (!s?.userId) {
    return NextResponse.json(
      { session: null },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
  return NextResponse.json(
    {
      session: {
        userId: s.userId,
        username: s.username,
        displayName: s.displayName,
        role: s.role,
        salesPoint: s.salesPoint,
        service:
          typeof s.service === "string" && s.service.trim() !== "" ? s.service.trim() : null,
        commercialService:
          s.commercialService &&
          typeof s.commercialService.id === "string" &&
          typeof s.commercialService.name === "string" &&
          typeof s.commercialService.invoicePrefix === "string"
            ? {
                id: s.commercialService.id,
                name: s.commercialService.name,
                invoicePrefix: s.commercialService.invoicePrefix,
              }
            : null,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
