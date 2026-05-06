import { getPrismaClient } from "@/lib/prisma";
import { getOrInitCompanySettings } from "@/lib/settings";
import { prismaRetry } from "@/lib/prisma-retry";
import {
  createSale,
  deleteSale,
  loadSaleByInvoiceNo,
  lookupDeliveryOrderForSale,
  previewPosTaxes,
  validateSale,
} from "./actions";
import { SalesClient } from "./SalesClient";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PosPage() {
  await getOrInitCompanySettings();
  const prisma = getPrismaClient();

  const [customers, grades, salesPoints] = await Promise.all([
    prismaRetry(() =>
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
    ),
    prismaRetry(() =>
      prisma.product.findMany({
        orderBy: [{ productName: "asc" }],
        select: {
          productId: true,
          productName: true,
          productCat: { select: { productCat: true } },
        },
        take: 50,
      }),
    ),
    prismaRetry(() =>
      prisma.salesPoint.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 200,
      }),
    ),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <p className="text-sm opacity-75">
          Payments allowed: cash, cheque. No credit sales.
        </p>
      </div>

      {customers.length === 0 || grades.length === 0 ? (
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 text-sm">
          <div className="font-medium">Setup required</div>
          <ul className="list-disc pl-5 opacity-80 mt-2 space-y-1">
            {customers.length === 0 ? <li>Add at least one customer.</li> : null}
            {grades.length === 0 ? <li>Add at least one product.</li> : null}
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
        <SalesClient
          customers={customers}
          products={grades}
          salesPoints={salesPoints}
          previewPosTaxesAction={previewPosTaxes}
          saveSaleAction={createSale}
          loadSaleByInvoiceNo={loadSaleByInvoiceNo}
          lookupDeliveryOrderAction={lookupDeliveryOrderForSale}
          validateSaleAction={validateSale}
          deleteSaleAction={deleteSale}
        />
      )}
    </div>
  );
}
