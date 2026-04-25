import { getPrismaClient } from "@/lib/prisma";
import { createCustomer } from "@/app/customers/actions";
import { ensureDefaultTaxRegimes } from "@/lib/taxRegimes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CustomersPage() {
  const prisma = getPrismaClient();
  await ensureDefaultTaxRegimes();

  const taxRegimes = await prisma.taxRegime.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, vatApplies: true },
  });

  const customers = await prisma.customer.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      customerType: true,
      taxpayerId: true,
      taxRegime: { select: { id: true, name: true, vatApplies: true } },
      createdAt: true,
    },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <p className="text-sm opacity-75">
          VAT is applied automatically based on each customer’s tax regime.
        </p>
      </div>

      <form action={createCustomer} className="space-y-4 max-w-xl">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
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
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email (optional)
          </label>
          <input
            id="email"
            name="email"
            type="email"
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
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="customerType">
            Customer type
          </label>
          <select
            id="customerType"
            name="customerType"
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            defaultValue="INDUSTRY"
          >
            <option value="INDUSTRY">Industry</option>
            <option value="WHOLE_SALE">Whole sale</option>
            <option value="RETAIL">Retail</option>
            <option value="WORKER">Worker</option>
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="taxRegime">
            Tax regime
          </label>
          <select
            id="taxRegime"
            name="taxRegime"
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            defaultValue={taxRegimes[0]?.id}
          >
            {taxRegimes.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name} ({tr.vatApplies ? "VAT applies" : "VAT exempt"})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="taxpayerId">
            Taxpayer ID (optional)
          </label>
          <input
            id="taxpayerId"
            name="taxpayerId"
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
          />
        </div>

        <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
          Add customer
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Recent customers</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium opacity-70 border-b border-black/10 dark:border-white/10">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2">Regime</div>
            <div className="col-span-1">Tax ID</div>
            <div className="col-span-2">Created</div>
          </div>
          {customers.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No customers yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {customers.map((c) => (
                <li key={c.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                  <div className="col-span-3 font-medium">{c.name}</div>
                  <div className="col-span-2 opacity-80">{c.phone ?? "-"}</div>
                  <div className="col-span-2 opacity-80">{c.customerType}</div>
                  <div className="col-span-2 opacity-80">{c.taxRegime.name}</div>
                  <div className="col-span-1 opacity-80">{c.taxpayerId ?? "-"}</div>
                  <div className="col-span-2 opacity-80">
                    {c.createdAt.toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

