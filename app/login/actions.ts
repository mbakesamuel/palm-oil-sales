"use server";

import { CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import type { AuthSession } from "@/lib/auth-session";
import type { UserRole } from "@/lib/domain";
import { getPrismaClient } from "@/lib/prisma";

export type LoginResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: string };

/**
 * After `signIn()`, `auth()` in the same server-action request often still sees the
 * pre-login cookies. Load the session from the DB instead (credentials were already verified).
 */
async function loadAuthSessionByUsername(username: string): Promise<AuthSession | null> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { username },
    include: { salesPoint: { select: { id: true, name: true } } },
  });
  if (!user?.isActive) return null;
  const salesPoint =
    user.salesPoint != null ? { id: user.salesPoint.id, name: user.salesPoint.name } : null;
  const service =
    typeof user.service === "string" && user.service.trim() !== "" ? user.service.trim() : null;
  return {
    userId: user.id,
    username: user.username,
    displayName: user.name,
    role: user.role as UserRole,
    salesPoint,
    service,
  };
}

export async function loginWithCredentials(
  usernameRaw: string,
  passwordRaw: string,
): Promise<LoginResult> {
  const username = String(usernameRaw ?? "").trim().toLowerCase();
  const password = String(passwordRaw ?? "");
  if (!username) return { ok: false, error: "Username is required." };
  if (!password) return { ok: false, error: "Password is required." };

  try {
    await signIn("credentials", { username, password, redirect: false });
  } catch (e) {
    if (e instanceof CredentialsSignin) {
      return {
        ok: false,
        error:
          "Invalid username or password, inactive account, or missing sales point for your role.",
      };
    }
    throw e;
  }

  const session = await loadAuthSessionByUsername(username);
  if (!session) {
    return {
      ok: false,
      error:
        "Invalid username or password, inactive account, or missing sales point for your role.",
    };
  }

  return { ok: true, session };
}
