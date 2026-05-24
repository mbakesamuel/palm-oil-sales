import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getServerSession } from "@/lib/auth-server";
import { loadStockOperationsPage } from "@/lib/load-stock-operations-page";
import { DatabaseErrorCallout } from "@/components/DatabaseErrorCallout";
import { StockOperationsClient } from "./StockOperationsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function StockOperationsFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded bg-foreground/10" />
      <div className="h-10 w-full max-w-md rounded bg-foreground/10" />
      <div className="h-32 rounded-lg bg-foreground/10" />
    </div>
  );
}

export default async function StockOperationsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const data = await loadStockOperationsPage(session);

  if (!data.ok) {
    if ("missingSalesPoint" in data) {
      return (
        <div className="space-y-4 max-w-xl">
          <h1 className="text-2xl font-semibold">Stock operations</h1>
          <div className="rounded-lg border border-amber-600/40 bg-amber-600/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
            Your role is tied to a sales point, but none is assigned. Ask an administrator.
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6 max-w-xl">
        <h1 className="text-2xl font-semibold">Stock operations</h1>
        <DatabaseErrorCallout title={data.dbError.title} description={data.dbError.description} />
      </div>
    );
  }

  return (
    <Suspense fallback={<StockOperationsFallback />}>
      <StockOperationsClient data={data} />
    </Suspense>
  );
}
