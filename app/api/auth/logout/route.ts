import { NextResponse } from "next/server";
import { auth, signOut } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Best-effort: call Auth.js to clear cookies.
  // Important: do NOT require an active session to sign out — if the browser has a stale cookie
  // we still want to overwrite/expire it to “unstick” users (especially across Vercel domains).
  try {
    const s = await auth();
    if (s?.userId) {
      const res = await signOut({ redirect: false });
      if (res instanceof Response) return res;
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
