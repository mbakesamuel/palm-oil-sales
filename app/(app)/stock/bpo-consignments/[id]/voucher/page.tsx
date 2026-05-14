import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { getServerSession } from "@/lib/auth-server";
import { loadBpoConsignmentVoucherPrint } from "../../actions";
import { ReportHeader } from "@/components/ReportHeader";
import { getOrInitCompanySettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(`${iso}T00:00:00.000Z`),
  );
}

export default async function BpoConsignmentVoucherPrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!id?.trim()) notFound();

  const session = await getServerSession();
  if (!session) redirect("/login");

  const payload = await loadBpoConsignmentVoucherPrint(id.trim());
  if (!payload.ok) notFound();
  const { data } = payload;

  const settings = await getOrInitCompanySettings();

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center gap-3">
        <Link
          href="/stock/bpo-consignments"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          Back
        </Link>
        <PrintButton label="Print voucher" />
      </div>

      <article className="text-foreground bg-background max-w-3xl mx-auto print:max-w-none print:mx-0 print:text-black print:bg-white">
        <ReportHeader
          companyName={settings.companyName}
          department={settings.department}
          logoSrc={settings.logoUrl}
          title="Consignment Voucher"
        />

        <header className="border-b border-border pb-4 print:border-black/20">
          <p className="text-xs uppercase tracking-[0.25em] text-black/60">
            Bottled Palm Oil
          </p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-black/70">
                Voucher No: {data.voucherNo}
              </p>
            </div>
            <div className="text-right text-sm">
              <div>Date: {formatDate(data.movementDateIso)}</div>
              <div>Status: {data.status}</div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded border border-border p-3 print:border-black/15">
            <div className="text-xs uppercase text-black/60">From</div>
            <div className="mt-1 font-medium">{data.sourceSalesPointName}</div>
          </div>
          <div className="rounded border border-border p-3 print:border-black/15">
            <div className="text-xs uppercase text-black/60">To</div>
            <div className="mt-1 font-medium">
              {data.destinationSalesPointName}
            </div>
          </div>
        </section>

        {data.note ? <p className="mt-4 text-sm">Note: {data.note}</p> : null}

        <section className="mt-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-border print:border-black/20">
                <th className="py-2 text-left font-medium">Variant</th>
                <th className="py-2 text-right font-medium">Voucher qty</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id} className="border-b border-border print:border-black/10">
                  <td className="py-2">{line.variantLabel}</td>
                  <td className="py-2 text-right tabular-nums">
                    {line.voucherQtyUnits}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-16 grid grid-cols-3 gap-12 text-sm">
          <div className="border-t border-border pt-2 print:border-black/40 flex items-center justify-center">
            <p>Sales Clerk</p>
          </div>
          <div></div>
          <div className="border-t border-border pt-2 print:border-black/40 flex items-center justify-center">
            <p>Sales Supervisor</p>
          </div>
        </section>
      </article>
    </div>
  );
}
