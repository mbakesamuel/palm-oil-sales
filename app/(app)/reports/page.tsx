import Link from "next/link";
import { ReportSignatory } from "@/components/ReportSignatory";

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
            <div className="font-medium">Sales register</div>
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
        <li>
          <Link
            href="/reports/delivery-order-monitor"
            className="block rounded-lg border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="font-medium">Delivery order monitor</div>
            <div className="text-sm opacity-75">
              Look up by DO number: header, sales history, quantities and amounts vs invoiced.
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/reports/customer-delivery-monitor"
            className="block rounded-lg border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="font-medium">Delivery orders by customer</div>
            <div className="text-sm opacity-75">
              All delivery orders for a customer with lines, sales, and complete / incomplete status.
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/reports/do-commitment-crosstab"
            className="block rounded-lg border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="font-medium">DO commitments (crosstab)</div>
            <div className="text-sm opacity-75">
              Customer - product × sales points: outstanding ordered vs invoiced quantity, with row and
              column totals (validated DOs and sales).
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/reports/stock-on-hand"
            className="block rounded-lg border border-black/10 dark:border-white/10 p-4 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <div className="font-medium">Stock on hand</div>
            <div className="text-sm opacity-75">
              Remaining kg by sales point and product (from recorded receipts and validated sales).
            </div>
          </Link>
        </li>
      </ul>

      <ReportSignatory />
    </div>
  );
}
