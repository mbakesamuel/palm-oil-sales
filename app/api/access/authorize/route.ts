import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";
import { isRouteAllowedForPath } from "@/lib/access-control";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathname = (url.searchParams.get("pathname") ?? "").trim();

  if (!pathname.startsWith("/")) {
    return NextResponse.json(
      { allowed: false },
      { status: 400, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const session = await getServerSession();
  if (!session) {
    return NextResponse.json(
      { allowed: false },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const allowed = await isRouteAllowedForPath(pathname, session);
  return NextResponse.json(
    { allowed },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

