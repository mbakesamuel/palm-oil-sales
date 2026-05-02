import type { UserRole } from "@/lib/domain";

declare module "next-auth" {
  interface Session {
    userId: string;
    username: string;
    displayName: string;
    role: UserRole;
    salesPoint: { id: number; name: string } | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    username?: string;
    displayName?: string;
    role?: UserRole;
    salesPoint?: { id: number; name: string } | null;
  }
}
