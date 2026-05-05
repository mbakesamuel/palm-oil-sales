import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Always return an explicit cookie-expiring response.
  // Do NOT call `auth()`/`signOut()` here: in production, `auth()` can refresh the session cookie
  // (sliding expiration) which re-sets the token during logout.
  const out = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
  const expire = new Date(0);
  const base = { path: "/", expires: expire as Date, maxAge: 0 };
  const lax = { sameSite: "lax" as const };
  const httpOnly = { httpOnly: true as const };

  // Non-secure variants (local/dev)
  for (const name of [
    // Auth.js (NextAuth v5)
    "authjs.session-token",
    "authjs.csrf-token",
    "authjs.callback-url",
    // NextAuth v4 naming (defensive)
    "next-auth.session-token",
    "next-auth.csrf-token",
    "next-auth.callback-url",
  ]) {
    out.cookies.set(name, "", { ...base, ...lax, ...httpOnly });
  }

  // Secure variants (Vercel/prod)
  for (const name of [
    // `__Host-` is also common for secure cookies (path=/, no domain).
    "__Host-authjs.session-token",
    "__Host-authjs.csrf-token",
    "__Host-authjs.callback-url",
    "__Host-next-auth.session-token",
    "__Host-next-auth.csrf-token",
    "__Host-next-auth.callback-url",
    "__Secure-authjs.session-token",
    "__Secure-authjs.csrf-token",
    "__Secure-authjs.callback-url",
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.csrf-token",
    "__Secure-next-auth.callback-url",
  ]) {
    out.cookies.set(name, "", { ...base, ...lax, ...httpOnly, secure: true });
  }

  return out;
}
