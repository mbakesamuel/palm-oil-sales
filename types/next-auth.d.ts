import type { UserRole } from "@/lib/domain";

declare module "next-auth" {
  interface Session {
    userId: string;
    username: string;
    displayName: string;
    role: UserRole;
    salesPoint: { id: number; name: string } | null;
    /** Optional sub-unit / service line for this user (from `User.service`). */
    service: string | null;
    commercialService: {
      id: string;
      name: string;
      invoicePrefix: string;
    } | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    username?: string;
    displayName?: string;
    role?: UserRole;
    salesPoint?: { id: number; name: string } | null;
    service?: string | null;
    commercialService?: {
      id: string;
      name: string;
      invoicePrefix: string;
    } | null;
  }
}
