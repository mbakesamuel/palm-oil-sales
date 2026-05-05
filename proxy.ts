import NextAuth from "next-auth";
import authConfig, { INVOKE_PATH_HEADER, isPublicOrAssetPath } from "@/auth.config";
import { isRouteAllowedForPath } from "@/lib/access-control";
import { NextResponse } from "next/server";

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
export default auth(async function proxy(request) {
  const pathname = request.nextUrl.pathname;
  const session = request.auth;

  if (
    session?.userId &&
    session.role &&
    !isPublicOrAssetPath(pathname) &&
    !(await isRouteAllowedForPath(pathname, session.role))
  ) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(INVOKE_PATH_HEADER, pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
