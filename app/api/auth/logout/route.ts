import { NextResponse } from "next/server";
import { auth, signOut } from "@/auth";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function POST() {
  const s = await auth();
  if (!s?.userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const res = await signOut({ redirect: false });
  // `signOut()` returns a Response that clears the auth cookies.
  // If we ignore it and return our own JSON, the browser keeps the session cookie.
  if (res instanceof Response) return res;

  // Defense-in-depth: explicitly expire Auth.js cookies (prod may use `__Secure-` prefix).
  const cookieStore = await cookies();
  const names = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.csrf-token",
    "__Secure-authjs.csrf-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
  ];
  for (const name of names) {
    cookieStore.set(name, "", { path: "/", expires: new Date(0) });
  }
  return NextResponse.json({ ok: true });
}
