import type { UserRole } from "@/lib/domain";
import type { CommercialSiteKind } from "@/lib/domain-commercial";
import type { CommercialModuleKey } from "@/lib/commercial-modules";

declare module "next-auth" {
  interface Session {
    userId: string;
    username: string;
    displayName: string;
    role: UserRole;
    globalRole: { id: string; code: string; displayName: string } | null;
    salesPoint: { id: number; name: string } | null;
    factory: { id: string; name: string } | null;
    /** Optional sub-unit / service line for this user (from `User.service`). */
    service: string | null;
    commercialService: {
      id: string;
      code: string;
      name: string;
      invoicePrefix: string;
      siteKind: CommercialSiteKind;
      enabledModules: CommercialModuleKey[];
    } | null;
    commercialServiceRole: {
      id: string;
      code: string;
      name: string;
      requiresFixedPostingSite: boolean;
    } | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    username?: string;
    displayName?: string;
    role?: UserRole;
    globalRole?: { id: string; code: string; displayName: string } | null;
    salesPoint?: { id: number; name: string } | null;
    factory?: { id: string; name: string } | null;
    service?: string | null;
    commercialService?: {
      id: string;
      code: string;
      name: string;
      invoicePrefix: string;
      siteKind: CommercialSiteKind;
      enabledModules: CommercialModuleKey[];
    } | null;
    commercialServiceRole?: {
      id: string;
      code: string;
      name: string;
      requiresFixedPostingSite: boolean;
    } | null;
  }
}
