import { NextResponse } from "next/server";
import { signOut } from "@/auth";

export const runtime = "nodejs";

export async function POST() {
  await signOut({ redirect: false });
  return NextResponse.json({ ok: true });
}
