import { getPrismaClient } from "@/lib/prisma";
import {
  createSalesPoint,
  deleteSalesPoint,
  updateSalesPoint,
} from "@/app/sales-points/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SalesPointsPage() {
  const prisma = getPrismaClient();
  const points = await prisma.salesPoint.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sales points</h1>
        <p className="text-sm opacity-75">
          Register outlets or counters (e.g. main depot, branch POS).
        </p>
      </div>

      <form action={createSalesPoint} className="space-y-3 max-w-xl">
        <div className="text-sm font-semibold">Add sales point</div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="newName">
            Name
          </label>
          <input
            id="newName"
            name="name"
            className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2"
            required
          />
        </div>
        <button className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm font-medium">
          Create
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">All sales points</h2>
        <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
          {points.length === 0 ? (
            <div className="p-4 text-sm opacity-75">No sales points yet.</div>
          ) : (
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {points.map((p) => (
                <li key={p.id} className="p-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <form action={updateSalesPoint} className="flex-1 flex flex-col sm:flex-row gap-2 sm:items-end">
                    <input type="hidden" name="id" value={p.id} />
                    <div className="grid gap-1 flex-1">
                      <label className="text-xs font-medium opacity-70" htmlFor={`name-${p.id}`}>
                        Name
                      </label>
                      <input
                        id={`name-${p.id}`}
                        name="name"
                        defaultValue={p.name}
                        className="rounded-md border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded-md border border-black/10 dark:border-white/10 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Save
                    </button>
                  </form>
                  <form action={deleteSalesPoint}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-600/40 text-red-700 dark:text-red-400 px-3 py-2 text-sm hover:bg-red-600/10"
                    >
                      Delete
                    </button>
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
