import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { resolveCommercialProfile, siteLabelForKind } from "@/lib/commercial-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function RubberHubPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const profile = resolveCommercialProfile(session);
  const factoryName = session.factory?.name ?? null;

  return (
    <section className="space-y-6 max-w-2xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Rubber sales</h1>
        <p className="text-sm opacity-75">
          {profile
            ? `${profile.name} · ${siteLabelForKind(profile.siteKind)} line`
            : "Commercial line hub"}
        </p>
      </header>

      {factoryName ? (
        <p className="rounded-lg border border-border px-4 py-3 text-sm">
          Your {siteLabelForKind("FACTORY").toLowerCase()}:{" "}
          <span className="font-medium">{factoryName}</span>
        </p>
      ) : (
        <p className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
          No factory is assigned to your account. Ask an administrator to assign one under
          Users.
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <Link
            href="/reports/sales"
            className="block rounded-lg border border-border p-4 hover:bg-accent/25"
          >
            <span className="font-medium">Sales register</span>
            <span className="block text-sm opacity-75 mt-1">View sales for your line.</span>
          </Link>
        </li>
        <li>
          <Link
            href="/customers"
            className="block rounded-lg border border-border p-4 hover:bg-accent/25"
          >
            <span className="font-medium">Customers</span>
            <span className="block text-sm opacity-75 mt-1">Manage customer records.</span>
          </Link>
        </li>
        <li>
          <Link
            href="/products"
            className="block rounded-lg border border-border p-4 hover:bg-accent/25"
          >
            <span className="font-medium">Products</span>
            <span className="block text-sm opacity-75 mt-1">Product catalog for your line.</span>
          </Link>
        </li>
      </ul>

      <p className="text-xs opacity-60">
        Additional rubber-specific workflows (factory stock, factory invoices) can be added here
        without changing palm-oil modules.
      </p>
    </section>
  );
}
