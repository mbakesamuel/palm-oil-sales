import { UserRole } from "@/lib/domain";

export { roleRequiresSalesPoint } from "./auth-roles";
export {
  sessionRequiresFixedPostingSite,
  userRequiresFixedPostingSite,
} from "./sales-point-assignment";

const LABELS: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Admin",
  [UserRole.DIRECTOR]: "Director",
  /** Line/site manager on a commercial service (not an org-wide global role). */
  [UserRole.MANAGER]: "Manager",
  [UserRole.OFFICER]: "Officer",
  [UserRole.SENIOR_SUPERVISOR]: "Senior sales supervisor",
  [UserRole.SUPERVISOR]: "Sales supervisor",
  [UserRole.CLERK]: "Sales clerk",
};

export function roleLabel(role: UserRole): string {
  return LABELS[role] ?? role;
}

/** Sidebar / profile: prefer the commercial line role name when assigned. */
export function sessionRoleLabel(session: {
  role: UserRole;
  commercialServiceRole?: { name: string } | null;
}): string {
  const lineName = session.commercialServiceRole?.name?.trim();
  if (lineName) return lineName;
  return roleLabel(session.role);
}
