import { NextResponse, type NextRequest } from "next/server";

/**
 * Minimal Edge middleware used to verify deployment behavior on Vercel.
 *
 * It does two things:
 * - forwards the current pathname upstream via a request header so App Router `headers()` can read it
 * - adds `x-proxy-hit: 1` to responses so you can confirm middleware execution in production
 *
 * Keep this file dependency-free and Edge-safe.
 */
export default function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-invoke-path", request.nextUrl.pathname);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set("x-proxy-hit", "1");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

