import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "@/auth.config";
import { getPrismaClient } from "@/lib/prisma";
import {
  loadAuthSessionByUserId,
  loadAuthSessionByUsername,
  mapAuthSessionToToken,
} from "@/lib/load-auth-session";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      const next = await authConfig.callbacks.jwt({
        token,
        user,
        trigger,
        session,
      });

      const userId = next.userId as string | undefined;
      if (!userId) return next;

      // Initial sign-in: `user` already carries fresh DB fields from authorize().
      if (user) return next;

      const forceRefresh = trigger === "update";
      const lastRefresh =
        typeof next.sessionRefreshedAt === "number" ? next.sessionRefreshedAt : 0;
      const refreshIntervalMs = 60_000;
      if (
        !forceRefresh &&
        lastRefresh > 0 &&
        Date.now() - lastRefresh < refreshIntervalMs
      ) {
        return next;
      }

      // Subsequent requests: reload role/line assignment (JWT can hold stale globalRole ids).
      try {
        const fresh = await loadAuthSessionByUserId(userId);
        if (fresh) {
          return {
            ...next,
            ...mapAuthSessionToToken(fresh),
            sessionRefreshedAt: Date.now(),
          };
        }
      } catch (err) {
        // Remote Postgres (e.g. Neon) can drop TLS mid-request; keep the cached JWT.
        console.warn("[auth] session refresh skipped (database unavailable):", err);
      }

      return next;
    },
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const username = String(credentials?.username ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!username || !password) return null;

        const prisma = getPrismaClient();
        const user = await prisma.user.findUnique({
          where: { username },
          select: {
            id: true,
            username: true,
            name: true,
            passwordHash: true,
            passwordPlain: true,
            isActive: true,
          },
        });
        if (!user || !user.isActive) return null;

        const hasHash = typeof user.passwordHash === "string" && user.passwordHash.length > 0;
        let valid = false;
        if (hasHash) {
          valid = await bcrypt.compare(password, user.passwordHash as string);
        } else if (user.passwordPlain && user.passwordPlain === password) {
          valid = true;
          const nextHash = await bcrypt.hash(password, 10);
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: nextHash },
          });
        }
        if (!valid) return null;

        const authSession = await loadAuthSessionByUsername(username);
        if (!authSession) return null;

        return {
          id: authSession.userId,
          name: authSession.displayName,
          email: `${authSession.username}@users.pos.local`,
          ...mapAuthSessionToToken(authSession),
        };
      },
    }),
  ],
});
