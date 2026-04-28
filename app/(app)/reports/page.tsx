import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ReportsIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm opacity-80 mt-1">
          Printable lists from the sidebar. Each report has a Print button that uses your browser’s
          print dialog (save as PDF or send to a printer).
        </p>
      </div>

      <ul className="space-y-3">
        <li>
          <Link
            href="/reports/sales"
            className="block rounded-lg border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="font-medium">POS sales</div>
            <div className="text-sm opacity-75">Invoices, customers, net / VAT / gross (XAF).</div>
          </Link>
        </li>
        <li>
          <Link
            href="/reports/delivery-orders"
            className="block rounded-lg border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="font-medium">Delivery orders</div>
            <div className="text-sm opacity-75">Recent delivery orders with line totals and fiscal period.</div>
          </Link>
        </li>
      </ul>
    </div>
  );
}
