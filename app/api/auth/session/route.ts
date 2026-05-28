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
        factory: s.factory,
        service:
          typeof s.service === "string" && s.service.trim() !== "" ? s.service.trim() : null,
        commercialService:
          s.commercialService &&
          typeof s.commercialService.id === "string" &&
          typeof s.commercialService.code === "string" &&
          typeof s.commercialService.name === "string" &&
          typeof s.commercialService.invoicePrefix === "string"
            ? {
                id: s.commercialService.id,
                code: s.commercialService.code,
                name: s.commercialService.name,
                invoicePrefix: s.commercialService.invoicePrefix,
                siteKind:
                  s.commercialService.siteKind === "FACTORY" ||
                  s.commercialService.siteKind === "SALES_POINT"
                    ? s.commercialService.siteKind
                    : "SALES_POINT",
                enabledModules: Array.isArray(s.commercialService.enabledModules)
                  ? s.commercialService.enabledModules.filter((x) => typeof x === "string")
                  : [],
              }
            : null,
        commercialServiceRole:
          s.commercialServiceRole &&
          typeof s.commercialServiceRole.id === "string" &&
          typeof s.commercialServiceRole.code === "string" &&
          typeof s.commercialServiceRole.name === "string"
            ? {
                id: s.commercialServiceRole.id,
                code: s.commercialServiceRole.code,
                name: s.commercialServiceRole.name,
              }
            : null,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
