import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/lib/domain";
import { NextResponse } from "next/server";

/** Read in `app/(app)/layout.tsx` for route permission checks (set in `proxy.ts` via `NextResponse.next({ request })`). */
export const INVOKE_PATH_HEADER = "x-invoke-path";

/** Shared with `proxy.ts`: paths where we skip DB-backed `route:*` checks (and auth treats as public for assets). */
export function isPublicOrAssetPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/forbidden") return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/images")
  ) {
    return true;
  }
  return /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|map|css|js)$/.test(pathname);
}

function resolveAuthSecret(): string {
  const fromEnv = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (fromEnv && fromEnv.trim() !== "") return fromEnv.trim();
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-insecure-secret-set-AUTH_SECRET-in-production";
  }
  throw new Error(
    "Missing AUTH_SECRET (or NEXTAUTH_SECRET). Set it in Vercel → Settings → Environment Variables " +
      "for Production and Preview. Generate one with: openssl rand -base64 32",
  );
}

/** Sliding JWT session length in seconds. Override with `AUTH_SESSION_MAX_AGE` (integer seconds). Default 1 hour. */
function resolveSessionMaxAgeSeconds(): number {
  const raw = process.env.AUTH_SESSION_MAX_AGE?.trim();
  if (!raw) return 60 * 60;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 60 || n > 365 * 24 * 60 * 60) {
    return 60 * 60;
  }
  return n;
}

const sessionMaxAgeSeconds = resolveSessionMaxAgeSeconds();

/**
 * Edge-safe Auth.js config (no Prisma, bcrypt, or other Node-only imports).
 * Used by `proxy.ts`. Full credentials + DB live in `auth.ts`.
 */
export default {
  providers: [],
  trustHost: true,
  secret: resolveAuthSecret(),
  session: { strategy: "jwt", maxAge: sessionMaxAgeSeconds },
  jwt: { maxAge: sessionMaxAgeSeconds },
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;

      if (isPublicOrAssetPath(pathname)) return true;

      // Auth.js shapes `auth` slightly differently depending on context (middleware vs server),
      // so accept a few common identifiers.
      const isAuthed =
        !!auth &&
        (typeof (auth as { userId?: unknown }).userId !== "undefined" ||
          typeof (auth as { user?: unknown }).user !== "undefined" ||
          typeof (auth as { user?: { id?: unknown } }).user?.id !== "undefined");
      if (isAuthed) return true;

      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", request.nextUrl.href);
      return NextResponse.redirect(url);
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as {
          id: string;
          role: UserRole;
          username: string;
          displayName: string;
          salesPoint: { id: number; name: string } | null;
          service?: string | null;
          commercialService?: {
            id: string;
            name: string;
            invoicePrefix: string;
          } | null;
        };
        token.sub = u.id;
        token.userId = u.id;
        token.role = u.role;
        token.username = u.username;
        token.displayName = u.displayName;
        token.salesPoint = u.salesPoint;
        token.service = u.service ?? null;
        token.commercialService = u.commercialService ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.username = token.username as string;
      session.displayName = (token.displayName as string) ?? "";
      session.role = token.role as UserRole;
      session.salesPoint =
        (token.salesPoint as { id: number; name: string } | null | undefined) ?? null;
      session.service =
        typeof token.service === "string" && token.service.trim() !== ""
          ? token.service.trim()
          : null;
      const csRaw = token.commercialService as
        | { id: string; name: string; invoicePrefix: string }
        | null
        | undefined;
      session.commercialService =
        csRaw &&
        typeof csRaw.id === "string" &&
        typeof csRaw.name === "string" &&
        typeof csRaw.invoicePrefix === "string"
          ? {
              id: csRaw.id,
              name: csRaw.name,
              invoicePrefix: csRaw.invoicePrefix,
            }
          : null;
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.name = session.displayName;
        session.user.email = `${session.username}@users.pos.local`;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
