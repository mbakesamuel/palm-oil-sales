import { getPrismaClient } from "@/lib/prisma";
import { ensureDefaultTaxRegimes } from "@/lib/taxRegimes";
import { createTaxRegime, updateTaxRegime } from "@/app/tax-regimes/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TaxRegimesPage() {
  const prisma = getPrismaClient();
  await ensureDefaultTaxRegimes();

  const regimes = await prisma.taxRegime.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      vatApplies: true,
      _count: { select: { customers: true, sales: true } },
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Tax regimes</h1>
        <p className="text-sm opacity-75">
          Manage VAT applicability per customer regime. POS uses this to decide
          whether VAT is charged.
        </p>
      </div>

      <form action={createTaxRegime} className="space-y-4 max-w-xl">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="name">
            New regime name
          </label>
          <input
            id="name"
            name="name"
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            placeholder="e.g. VAT_APPLICABLE"
            required
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="vatApplies" defaultChecked />
          <span>VAT applies</span>
        </label>

        <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
          Create regime
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Existing regimes</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-4">Name</div>
            <div className="col-span-2">VAT</div>
            <div className="col-span-2">Customers</div>
            <div className="col-span-2">Sales</div>
            <div className="col-span-2">Actions</div>
          </div>

          {regimes.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No tax regimes yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {regimes.map((r) => (
                <li key={r.id} className="px-3 py-3">
                  <form
                    action={updateTaxRegime}
                    className="grid grid-cols-12 gap-2 items-center"
                  >
                    <input type="hidden" name="id" value={r.id} />
                    <div className="col-span-4">
                      <input
                        name="name"
                        defaultValue={r.name}
                        className="w-full rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="vatApplies"
                          defaultChecked={r.vatApplies}
                        />
                        <span className="opacity-80">
                          {r.vatApplies ? "Applies" : "Exempt"}
                        </span>
                      </label>
                    </div>
                    <div className="col-span-2 text-sm opacity-80">
                      {r._count.customers}
                    </div>
                    <div className="col-span-2 text-sm opacity-80">
                      {r._count.sales}
                    </div>
                    <div className="col-span-2">
                      <button className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                        Save
                      </button>
                    </div>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

