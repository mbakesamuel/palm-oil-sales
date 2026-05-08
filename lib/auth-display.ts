import { UserRole } from "@/lib/domain";

export { roleRequiresSalesPoint } from "./auth-roles";

const LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Admin",
  [UserRole.DIRECTOR]: "Director",
  [UserRole.MANAGER]: "Manager",
  [UserRole.SENIOR_SUPERVISOR]: "Senior sales supervisor",
  [UserRole.SUPERVISOR]: "Sales supervisor",
  [UserRole.CLERK]: "Sales clerk",
  [UserRole.CLERK_IN_CHARGE_BPO]: "Clerk in charge BPO",
};

export function roleLabel(role: UserRole): string {
  return LABELS[role] ?? role;
}
