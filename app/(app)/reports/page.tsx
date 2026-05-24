import Link from "next/link";
import { ReportSignatory } from "@/components/ReportSignatory";
import { reportsByGroup } from "@/lib/reports-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function ReportsIndexPage() {
  const groups = reportsByGroup();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm opacity-80 mt-1">
          Printable lists from the sidebar. Each report has a Print button that uses your browser’s
          print dialog (save as PDF or send to a printer).
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.id} className="space-y-3">
          <h2 className="text-lg font-semibold">{group.label}</h2>
          <ul className="space-y-2">
            {group.reports.map((report) => (
              <li key={report.href}>
                <Link
                  href={report.href}
                  className="block rounded-lg border border-border p-4 hover:bg-accent/25"
                >
                  <div className="font-medium">{report.label}</div>
                  <div className="text-sm opacity-75">{report.description}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <div className="hidden print:block">
        <ReportSignatory />
      </div>
    </div>
  );
}
