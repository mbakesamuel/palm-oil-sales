import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-16 space-y-4 text-center">
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="text-sm opacity-80">
        You are signed in, but your role is not allowed to open that screen. Use the menu or go
        back to the dashboard.
      </p>
      <div className="flex flex-col gap-3 text-sm items-center">
        <Link className="underline underline-offset-4" href="/dashboard">
          Dashboard
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
