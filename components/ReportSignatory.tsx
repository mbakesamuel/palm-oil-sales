import { getServerSession } from "@/lib/auth-server";
import { roleRequiresSalesPoint } from "@/lib/auth-roles";
import type { UserRole } from "@/lib/domain";

/** Bottom-right signature line for printed reports. */
export async function ReportSignatory() {
  const session = await getServerSession();
  const role = session?.role as UserRole | undefined;
  const titleLine =
    role != null && roleRequiresSalesPoint(role)
      ? "Sales Supervisor"
      : "Manager, Local Sales";

  return (
    <div className="mt-16 flex justify-end print:mt-20 print:break-inside-avoid">
      <div className="w-56 text-center text-sm">
        <div
          className="min-h-10 w-full border-b border-black/50 dark:border-white/50"
          aria-hidden
        />
        <p className="mt-2 font-medium">{titleLine}</p>
      </div>
    </div>
  );
}
