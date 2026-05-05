import NextAuth from "next-auth";
import authConfig, { INVOKE_PATH_HEADER } from "@/auth.config";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

const { auth } = NextAuth(authConfig);

/**
 * Pathname must be forwarded with `NextResponse.next({ request: { headers } })` so it reaches
 * `headers()` in App Router layouts. Cloning `NextRequest` and passing it into `auth()` alone
 * does not propagate custom headers upstream (see Next.js Proxy docs: “Setting Headers”).
 *
 * `route:*` enforcement runs here (using `request.nextUrl.pathname`) so it applies on every
 * navigation including client-side RSC requests. The `(app)` layout only sees `x-invoke-path`
 * intermittently; skipping checks when that header is missing would fail open.
 */
export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  // IMPORTANT: avoid wrapping the logout route with Auth.js middleware.
  // Auth.js may refresh the session cookie (sliding expiration) during the middleware session lookup,
  // which would re-set `__Secure-authjs.session-token` on the logout response.
  if (pathname === "/api/auth/logout") {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(INVOKE_PATH_HEADER, pathname);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-proxy-hit", "1");
    return res;
  }

  // NOTE: Keep Proxy edge-safe. Do not call Prisma / DB-backed permission checks here.
  // Route enforcement happens in `app/(app)/layout.tsx` (node runtime).
  const wrapped = auth((req) => {
    const p = req.nextUrl.pathname;

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(INVOKE_PATH_HEADER, p);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-proxy-hit", "1");
    return res;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (wrapped as any)(request, event);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
