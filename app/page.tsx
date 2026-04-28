import Link from "next/link";
import { getOrInitCompanySettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const settings = await getOrInitCompanySettings();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="rounded-2xl border border-black/10 dark:border-white/10 p-6 sm:p-10">
        <div className="space-y-3">
          {settings.department ? (
            <div className="text-lg font-semibold opacity-70 uppercase tracking-wide">
              {settings.department}
            </div>
          ) : null}
          <div className="text-sm font-semibold opacity-70">
            {settings.companyName}
          </div>
          <h1 className="text-3xl font-semibold">Welcome</h1>
          <p className="opacity-80 max-w-2xl">
            Manage palm oil products, palm oil stock, sales, and reporting.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium"
          >
            Continue to login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-black/10 dark:border-white/10 px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
          >
            View dashboard (temporary)
          </Link>
        </div>
      </div>
    </div>
  );
}
