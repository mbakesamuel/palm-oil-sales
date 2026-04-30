"use server";

import { getPrismaClient } from "@/lib/prisma";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import type { AuthSalesPoint, AuthSession } from "@/lib/auth-session";

export type LoginResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string };

export async function loginWithCredentials(
  usernameRaw: string,
  passwordRaw: string,
): Promise<LoginResult> {
  const username = String(usernameRaw ?? "").trim().toLowerCase();
  const password = String(passwordRaw ?? "");
  if (!username) return { ok: false, error: "Username is required." };
  if (!password) return { ok: false, error: "Password is required." };

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { username },
    include: { salesPoint: { select: { id: true, name: true } } },
  });
  if (!user || !user.isActive) {
    return { ok: false, error: "Invalid username or password." };
  }
  if (user.passwordPlain !== password) {
    return { ok: false, error: "Invalid username or password." };
  }

  let salesPoint: AuthSalesPoint | null = null;
  if (roleRequiresSalesPoint(user.role)) {
    if (!user.salesPoint) {
      return {
        ok: false,
        error:
          "Your account has no sales point assigned. Ask an administrator to set one before you can sign in.",
      };
    }
    salesPoint = { id: user.salesPoint.id, name: user.salesPoint.name };
  }

  const session: AuthSession = {
    userId: user.id,
    username: user.username,
    displayName: user.name,
    role: user.role,
    salesPoint,
  };
  return { ok: true, session };
}
