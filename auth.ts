import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "@/auth.config";
import { getPrismaClient } from "@/lib/prisma";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import type { UserRole } from "@/lib/domain";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
          include: { salesPoint: { select: { id: true, name: true } } },
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

        if (roleRequiresSalesPoint(user.role)) {
          if (!user.salesPoint) return null;
        }

        const displayName = user.name;
        const salesPoint =
          user.salesPoint != null
            ? { id: user.salesPoint.id, name: user.salesPoint.name }
            : null;

        return {
          id: user.id,
          name: displayName,
          email: `${user.username}@users.pos.local`,
          role: user.role as UserRole,
          username: user.username,
          displayName,
          salesPoint,
        };
      },
    }),
  ],
});
