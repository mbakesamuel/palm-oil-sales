import Link from "next/link";
import { DashboardSessionCard } from "./DashboardSessionCard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="opacity-80">
        Choose a module from the sidebar to start working.
      </p>

      <DashboardSessionCard />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/pos"
          className="rounded-lg border border-border p-4 hover:bg-accent/25"
        >
          <div className="font-medium">Sales</div>
          <div className="text-sm opacity-75">Create a sale (cash/cheque).</div>
        </Link>
        <Link
          href="/products"
          className="rounded-lg border border-border p-4 hover:bg-accent/25"
        >
          <div className="font-medium">Products</div>
          <div className="text-sm opacity-75">Manage products; categories live under Setup.</div>
        </Link>
        <Link
          href="/customers"
          className="rounded-lg border border-border p-4 hover:bg-accent/25"
        >
          <div className="font-medium">Customers</div>
          <div className="text-sm opacity-75">Tax regime, taxpayer ID, contact info.</div>
        </Link>
        <Link
          href="/setup"
          className="rounded-lg border border-border p-4 hover:bg-accent/25"
        >
          <div className="font-medium">Setup</div>
          <div className="text-sm opacity-75">Company, VAT rate, invoice prefix.</div>
        </Link>
      </div>
    </div>
  );
}

