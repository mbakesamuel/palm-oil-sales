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
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
