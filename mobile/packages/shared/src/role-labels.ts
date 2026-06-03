/** Client-safe role labels (mirrors `lib/auth-display.ts`). */

export const USER_ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  DIRECTOR: "Director",
  MANAGER: "Manager",
  OFFICER: "Officer",
  SENIOR_SUPERVISOR: "Senior sales supervisor",
  SUPERVISOR: "Sales supervisor",
  CLERK: "Sales clerk",
};

export function roleLabelForCode(role: string): string {
  return USER_ROLE_LABELS[role] ?? role;
}

/** Prefer commercial line role name, then legacy role label. */
export function mobileSessionRoleLabel(session: {
  role: string;
  commercialServiceRole?: { name: string } | null;
}): string {
  const lineName = session.commercialServiceRole?.name?.trim();
  if (lineName) return lineName;
  return roleLabelForCode(session.role);
}
