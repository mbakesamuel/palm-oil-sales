"use server";

import { CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import type { AuthSession } from "@/lib/auth-session";
import { loadAuthSessionByUsername } from "@/lib/load-auth-session";

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
