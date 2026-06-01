import Link from "next/link";
import { sessionRoleLabel } from "@/lib/auth-display";
import { getServerSession } from "@/lib/auth-server";
import { resolveHomeDashboardPath } from "@/lib/dashboard-routing";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function ForbiddenPage() {
  const session = await getServerSession();

  return (
    <div className="mx-auto max-w-md px-6 py-16 space-y-4 text-center">
      <h1 className="text-xl font-semibold">Access denied</h1>
      {session ? (
        <p className="text-sm opacity-80">
         <span className="text-foreground/90">{sessionRoleLabel(session)}</span>.
          role is not allowed to open the page you tried to reach. Use the
          menu for screens you can access, or go back to the dashboard.
        </p>
      ) : (
        <p className="text-sm opacity-80">
          You do not have access to that page. Sign in with an account that has
          the right permissions.
        </p>
      )}
      <div className="flex flex-col gap-3 text-sm items-center">
        {session ? (
          <>
            <Link
              className="underline underline-offset-4"
              href={resolveHomeDashboardPath(session)}
            >
              Dashboard
            </Link>
            <SignOutButton />
          </>
        ) : (
          <Link className="underline underline-offset-4" href="/login">
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
