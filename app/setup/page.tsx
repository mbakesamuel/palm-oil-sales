import { getOrInitCompanySettings } from "@/lib/settings";
import { getPrismaClient } from "@/lib/prisma";
import { saveCompanySettings } from "@/app/setup/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SetupPage() {
  const settings = await getOrInitCompanySettings();
  const prisma = getPrismaClient();
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, role: true },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Setup</h1>
        <p className="text-sm opacity-75">
          Configure your company info, VAT rate, and invoice prefix.
        </p>
      </div>

      <form action={saveCompanySettings} className="space-y-4 max-w-xl">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="companyName">
            Company name
          </label>
          <input
            id="companyName"
            name="companyName"
            defaultValue={settings.companyName}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            required
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="phone">
            Phone (optional)
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={settings.phone ?? ""}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="address">
            Address (optional)
          </label>
          <input
            id="address"
            name="address"
            defaultValue={settings.address ?? ""}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="vatRate">
            VAT rate (decimal)
          </label>
          <input
            id="vatRate"
            name="vatRate"
            defaultValue={String(settings.vatRate)}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            inputMode="decimal"
            required
          />
          <div className="text-xs opacity-70">Use `0.1925` for 19.25%.</div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="invoicePrefix">
            Invoice prefix
          </label>
          <input
            id="invoicePrefix"
            name="invoicePrefix"
            defaultValue={settings.invoicePrefix}
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            required
          />
        </div>

        <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
          Save settings
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cashiers (users)</h2>
        <p className="text-sm opacity-75">
          POS sales are recorded per user to support per-user cash totals.
        </p>
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
          {users.length === 0 ? (
            <div className="text-sm opacity-75">
              No users yet. Saving settings will create default Admin and Clerk
              users.
            </div>
          ) : (
            <ul className="text-sm space-y-1">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3">
                  <span>{u.name}</span>
                  <span className="opacity-70">{u.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

