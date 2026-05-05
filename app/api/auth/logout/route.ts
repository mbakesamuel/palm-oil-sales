import { NextResponse } from "next/server";
import { auth, signOut } from "@/auth";

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
  return NextResponse.json({ ok: true });
}
