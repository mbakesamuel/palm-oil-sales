import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { createSale } from "./actions";
import { PosForm } from "./PosForm";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PosPage() {
  const settings = await getOrInitCompanySettings();
  const prisma = getPrismaClient();

  const [customers, grades, users] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        taxRegime: { select: { name: true, vatApplies: true } },
        taxRegimeId: true,
      },
      take: 200,
    }),
    prisma.product.findMany({
      orderBy: [{ productName: "asc" }],
      select: {
        productId: true,
        productName: true,
        productCat: { select: { productCat: true } },
      },
      take: 50,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, role: true },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">POS</h1>
        <p className="text-sm opacity-75">
          Payments allowed: cash, cheque. No credit sales.
        </p>
      </div>

      {customers.length === 0 || grades.length === 0 || users.length === 0 ? (
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 text-sm">
          <div className="font-medium">Setup required</div>
          <ul className="list-disc pl-5 opacity-80 mt-2 space-y-1">
            {customers.length === 0 ? <li>Add at least one customer.</li> : null}
            {grades.length === 0 ? <li>Add at least one product.</li> : null}
            {users.length === 0 ? <li>Create at least one user under Setup (save settings).</li> : null}
          </ul>
          <div className="mt-3 flex gap-3">
            <Link className="underline underline-offset-4" href="/customers">
              Customers
            </Link>
            <Link className="underline underline-offset-4" href="/products">
              Products
            </Link>
            <Link className="underline underline-offset-4" href="/setup">
              Setup
            </Link>
          </div>
        </div>
      ) : (
        <PosForm
          customers={customers}
          grades={grades}
          users={users}
          vatRateDecimal={String(settings.vatRate)}
          action={createSale}
        />
      )}
    </div>
  );
}
