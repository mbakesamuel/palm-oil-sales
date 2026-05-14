import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { getServerSession } from "@/lib/auth-server";
import { loadBpoConsignmentConfirmationPrint } from "../../actions";
import { getOrInitCompanySettings } from "@/lib/settings";
import { ReportHeader } from "@/components/ReportHeader";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(
    new Date(`${iso}T00:00:00.000Z`),
  );
}

export default async function BpoConsignmentConfirmationPrintPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!id?.trim()) notFound();

  const session = await getServerSession();
  if (!session) redirect("/login");

  const payload = await loadBpoConsignmentConfirmationPrint(id.trim());
  if (!payload.ok) notFound();
  const { data } = payload;

  const settings = await getOrInitCompanySettings();

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-end items-center gap-3">
        <Link
          href="/stock/bpo-consignments"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          Back
        </Link>
        <PrintButton label="Print confirmation receipt" />
      </div>

      <article className="text-foreground bg-background max-w-3xl mx-auto print:max-w-none print:mx-0 print:text-black print:bg-white">
        <header className="border-b border-border pb-4 print:border-black/20">
          <ReportHeader
            companyName={settings.companyName}
            department={settings.department}
            logoSrc={settings.logoUrl}
            title="Bota Confirmation Receipt"
          />
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-black/70">
                Voucher No: {data.voucherNo}
              </p>
            </div>
            <div className="text-right text-sm">
              <div>Movement date: {formatDate(data.movementDateIso)}</div>
              <div>Posted: {formatDateTime(data.postedAtIso)}</div>
            </div>
          </div>
        </header>
        <section className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded border border-border p-3 print:border-black/15">
            <div className="text-xs uppercase text-black/60">
              Transferred from
            </div>
            <div className="mt-1 font-medium">{data.sourceSalesPointName}</div>
          </div>
          <div className="rounded border border-border p-3 print:border-black/15">
            <div className="text-xs uppercase text-black/60">Received at</div>
            <div className="mt-1 font-medium">
              {data.destinationSalesPointName}
            </div>
          </div>
        </section>

        <section className="mt-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-border print:border-black/20">
                <th className="py-2 text-left font-medium">Variant</th>
                <th className="py-2 text-right font-medium">Voucher qty</th>
                <th className="py-2 text-right font-medium">Actual received</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id} className="border-b border-border print:border-black/10">
                  <td className="py-2">{line.variantLabel}</td>
                  <td className="py-2 text-right tabular-nums">
                    {line.voucherQtyUnits}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {line.actualQtyUnits ?? line.postedQtyUnits ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {data.discrepancyNote ? (
          <section className="mt-4 rounded border border-border p-3 print:border-black/15 text-sm">
            <div className="font-medium">Discrepancy note</div>
            <p className="mt-1">{data.discrepancyNote}</p>
          </section>
        ) : null}

        <section className="mt-6 grid gap-2 text-sm">
          <div>Sender validated by: {data.senderValidatedByName ?? "-"}</div>
          <div>
            Sender validation time: {formatDateTime(data.senderValidatedAtIso)}
          </div>
          <div>Bota confirmed by: {data.botaValidatedByName ?? "-"}</div>
          <div>
            Bota confirmation time: {formatDateTime(data.botaValidatedAtIso)}
          </div>
        </section>

        <section className="mt-16 grid grid-cols-3 gap-30 text-sm">
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
