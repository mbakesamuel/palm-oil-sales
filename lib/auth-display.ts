import { UserRole } from "@prisma/client";

const LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Admin",
  [UserRole.MANAGER]: "Manager",
  [UserRole.SUPERVISOR]: "Supervisor",
  [UserRole.CLERK]: "Clerk",
};

export function roleLabel(role: UserRole): string {
  return LABELS[role] ?? role;
}

export function roleRequiresSalesPoint(role: UserRole): boolean {
  return role === UserRole.CLERK || role === UserRole.SUPERVISOR;
}
