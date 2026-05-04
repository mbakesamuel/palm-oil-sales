import { NextResponse } from "next/server";
import { auth, signOut } from "@/auth";

export const runtime = "nodejs";

export async function POST() {
  const s = await auth();
  if (!s?.userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  await signOut({ redirect: false });
  return NextResponse.json({ ok: true });
}
