import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import type { NextFetchEvent, NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // `auth` is the Next.js middleware entry; TypeScript overloads also match Pages API signatures.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (auth as any)(request, event);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
