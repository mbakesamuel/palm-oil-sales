import { NextResponse } from "next/server";
import { auth, signOut } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const s = await auth();
  if (!s?.userId) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  // Best-effort: call Auth.js to clear cookies.
  const res = await signOut({ redirect: false });
  if (res instanceof Response) return res;

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
  out.cookies.set("authjs.session-token", "", { ...base, ...lax });
  out.cookies.set("authjs.csrf-token", "", { ...base, ...lax });
  out.cookies.set("authjs.callback-url", "", { ...base, ...lax });

  // Secure variants (Vercel/prod)
  out.cookies.set("__Secure-authjs.session-token", "", {
    ...base,
    ...lax,
    secure: true,
  });
  out.cookies.set("__Secure-authjs.csrf-token", "", { ...base, ...lax, secure: true });
  out.cookies.set("__Secure-authjs.callback-url", "", { ...base, ...lax, secure: true });

  return out;
}
