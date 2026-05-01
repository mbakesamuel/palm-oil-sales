import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth-server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession();
  return NextResponse.json({ session });
}

