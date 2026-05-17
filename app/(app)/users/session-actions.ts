"use server";

import { unstable_update } from "@/auth";
import type { AuthSession } from "@/lib/auth-session";
import { getServerSession } from "@/lib/auth-server";
import { loadAuthSessionByUserId } from "@/lib/load-auth-session";

/** Reload JWT session claims from the database for the signed-in user. */
export async function refreshCurrentUserSession(): Promise<AuthSession | null> {
  const current = await getServerSession();
  if (!current?.userId) return null;

  await unstable_update({});
  return loadAuthSessionByUserId(current.userId);
}
