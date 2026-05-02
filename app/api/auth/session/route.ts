import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";

export async function GET() {
  const s = await auth();
  if (!s?.userId) {
    return NextResponse.json({ session: null });
  }
  return NextResponse.json({
    session: {
      userId: s.userId,
      username: s.username,
      displayName: s.displayName,
      role: s.role,
      salesPoint: s.salesPoint,
    },
  });
}
