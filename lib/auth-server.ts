import "server-only";

import crypto from "crypto";
import { cookies } from "next/headers";
import { getPrismaClient } from "@/lib/prisma";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import type { AuthSession as ClientSession, AuthSalesPoint } from "@/lib/auth-session";

export const AUTH_COOKIE_NAME = "po_session";

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export async function createAuthSessionCookie(userId: string): Promise<string> {
  const prisma = getPrismaClient();
  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(raw);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

  await prisma.authSession.create({
    data: { userId, tokenHash, expiresAt },
  });

  const store = await cookies();
  store.set(AUTH_COOKIE_NAME, raw, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
  return raw;
}

export async function clearAuthSessionCookie(): Promise<void> {
  const prisma = getPrismaClient();
  const store = await cookies();
  const raw = store.get(AUTH_COOKIE_NAME)?.value ?? null;
  if (raw) {
    const tokenHash = sha256Hex(raw);
    await prisma.authSession.deleteMany({ where: { tokenHash } });
  }
  store.delete(AUTH_COOKIE_NAME);
}

export async function getServerSession(): Promise<ClientSession | null> {
  const store = await cookies();
  const raw = store.get(AUTH_COOKIE_NAME)?.value ?? null;
  if (!raw) return null;

  const prisma = getPrismaClient();
  const tokenHash = sha256Hex(raw);
  const row = await prisma.authSession.findUnique({
    where: { tokenHash },
    include: {
      user: { include: { salesPoint: { select: { id: true, name: true } } } },
    },
  });

  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.deleteMany({ where: { tokenHash } });
    return null;
  }
  const user = row.user;
  if (!user.isActive) return null;

  let salesPoint: AuthSalesPoint | null = null;
  if (roleRequiresSalesPoint(user.role)) {
    if (!user.salesPoint) return null;
    salesPoint = { id: user.salesPoint.id, name: user.salesPoint.name };
  }

  return {
    userId: user.id,
    username: user.username,
    displayName: user.name,
    role: user.role,
    salesPoint,
  };
}

