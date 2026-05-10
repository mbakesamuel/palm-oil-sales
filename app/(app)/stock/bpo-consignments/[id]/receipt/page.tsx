import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { getServerSession } from "@/lib/auth-server";
import { getOrInitCompanySettings } from "@/lib/settings";
import { loadBpoConsignmentReceiptVoucherPrint } from "../../actions";
import { ReportHeader } from "@/components/ReportHeader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(`${iso}T00:00:00.000Z`),
  );
}

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function BpoReceiptVoucherPrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!id?.trim()) notFound();

  const session = await getServerSession();
  if (!session) redirect("/login");

  const settings = await getOrInitCompanySettings();
  const payload = await loadBpoConsignmentReceiptVoucherPrint(id.trim());
  if (!payload.ok) notFound();
  const { data } = payload;

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center gap-3">
        <Link
          href="/stock/bpo-consignments"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          Back
        </Link>
        <PrintButton label="Print receipt voucher" />
      </div>

      <article className="text-black bg-white max-w-3xl mx-auto print:max-w-none print:mx-0">
        <header className="border-b border-black/20 pb-4 flext items-center justify-center">
          <ReportHeader
            companyName={settings.companyName}
            department={settings.department}
            logoSrc={settings.logoUrl}
            title="Receipt Cross-check Voucher"
          />

          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-black/70">
                Voucher No: {data.voucherNo}
              </p>
            </div>
            <div className="text-right text-sm">
              <div>Movement date: {formatDate(data.movementDateIso)}</div>
              <div>
                Sender validated: {formatDateTime(data.senderValidatedAtIso)}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded border border-black/15 p-3">
            <div className="text-xs uppercase text-black/60">
              Transferred from
            </div>
            <div className="mt-1 font-medium">{data.sourceSalesPointName}</div>
          </div>
          <div className="rounded border border-black/15 p-3">
            <div className="text-xs uppercase text-black/60">Received at</div>
            <div className="mt-1 font-medium">
              {data.destinationSalesPointName}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-black/20">
                <th className="py-2 text-left font-medium">Bottle Product</th>
                <th className="py-2 text-right font-medium">Voucher qty</th>
                <th className="py-2 text-right font-medium">Physical qty</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id} className="border-b border-black/10">
                  <td className="py-2">{line.variantLabel}</td>
                  <td className="py-2 text-right tabular-nums">
                    {line.voucherQtyUnits}
                  </td>
                  <td className="py-2 text-right">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {data.note ? <p className="mt-4 text-sm">Note: {data.note}</p> : null}

        <section className="mt-6 text-sm">
          <div>Sender validated by: {data.senderValidatedByName ?? "-"}</div>
          <div>Prepared by: {data.createdByName}</div>
        </section>

        <section className="mt-16 grid grid-cols-3 gap-12 text-sm">
          <div className="border-t border-black/40 pt-2 flex items-center justify-center">
            <p>Sales Clerk</p>
          </div>
          <div></div>
          <div className="border-t border-black/40 pt-2 flex items-center justify-center">
            <p>Sales Supervisor</p>
          </div>
        </section>
      </article>
    </div>
  );
}
