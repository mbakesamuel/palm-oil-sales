import { NextResponse } from "next/server";
import { auth, signOut } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Best-effort: ask Auth.js to sign out (may rotate tokens / clean up).
  // IMPORTANT: we DO NOT return Auth.js' Response because its behavior (redirect vs JSON, cookie
  // attributes) can vary by environment. We always return our own explicit cookie-expiring response
  // to ensure the browser actually clears the cookie on Vercel.
  try {
    const s = await auth();
    if (s?.userId) {
      await signOut({ redirect: false });
    }
  } catch {
    // ignore and fall through to manual cookie expiry
  }

  // Defense-in-depth: explicitly expire Auth.js cookies on the response.
  // In production, cookies may be `Secure` and prefixed with `__Secure-`, so we mirror that.
  const out = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
  const expire = new Date(0);
  const base = { path: "/", expires: expire as Date };
  const lax = { sameSite: "lax" as const };

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
    out.cookies.set(name, "", { ...base, ...lax });
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
    out.cookies.set(name, "", { ...base, ...lax, secure: true });
  }

  return out;
}
