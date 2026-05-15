import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { getServerSession } from "@/lib/auth-server";
import { loadBpoOutboundSaleReceipt } from "@/app/(app)/stock/bpo-outbound/actions";
import { ReportHeader } from "@/components/ReportHeader";
import { getOrInitCompanySettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function moneyLabel(value: string) {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} XAF`;
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function BpoSalesReceiptPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!id?.trim()) notFound();

  const session = await getServerSession();
  if (!session) redirect("/login");

  const payload = await loadBpoOutboundSaleReceipt(id);
  if (!payload.ok) notFound();
  const { data } = payload;

  const settings = await getOrInitCompanySettings();

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center gap-3">
        <Link
          href="/bpo-sales"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          Back
        </Link>
        <PrintButton label="Print receipt" />
      </div>

      <article className="text-foreground bg-background max-w-3xl mx-auto print:max-w-none print:mx-0 print:text-black print:bg-white">
        <header className="border-b border-border pb-4 text-center print:border-black/20">
          <ReportHeader
            companyName={settings.companyName}
            department={settings.department}
            logoSrc={settings.logoUrl}
            title="Bottled Palm Oil Sales Receipt"
          />
        </header>

        <section className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded border border-border p-3 print:border-black/15">
            <div className="text-xs uppercase text-black/60">Receipt / invoice</div>
            <div className="mt-1 font-semibold tabular-nums">{data.invoiceNo}</div>
            <div className="mt-1 text-black/70">{formatDateTime(data.soldAtIso)}</div>
          </div>
          <div className="rounded border border-border p-3 print:border-black/15">
            <div className="text-xs uppercase text-black/60">Payment</div>
            <div className="mt-1 font-semibold">
              {data.paymentMethod === "CREDIT" ? "Employee credit" : "Cash"}
            </div>
            <div className="mt-1 text-black/70">{data.customerName}</div>
            {data.employeeLabel ? (
              <div className="mt-1 text-black/70">{data.employeeLabel}</div>
            ) : null}
          </div>
        </section>

        <section className="mt-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-border print:border-black/20">
                <th className="py-2 text-left font-medium">Product</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Unit price</th>
                <th className="py-2 text-right font-medium">Net</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((line) => (
                <tr key={line.id} className="border rounded-lg border-border print:border-black/10">
                  <td className="py-2 p-3">{line.variantLabel}</td>
                  <td className="py-2 text-right tabular-nums">{line.qtyUnits}</td>
                  <td className="py-2 text-right tabular-nums">
                    {moneyLabel(line.unitPricePerUnit)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{moneyLabel(line.lineNet)}</td>
                  <td className="py-2 p-3 text-right tabular-nums">{moneyLabel(line.lineGross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-6 flex justify-end">
          <div className="min-w-64 space-y-1 text-sm">
            <div className="flex justify-between gap-8">
              <span className="text-black/70">Subtotal</span>
              <span className="tabular-nums">{moneyLabel(data.netAmount)}</span>
            </div>
            {data.taxLines.map((tax, idx) => (
              <div key={`${tax.label}-${idx}`} className="flex justify-between gap-8">
                <span className="text-black/70">
                  {tax.label} ({tax.ratePercentLabel}%)
                </span>
                <span className="tabular-nums">{moneyLabel(tax.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between gap-8 border-t border-border pt-2 font-semibold print:border-black/20">
              <span>Amount paid</span>
              <span className="tabular-nums">{moneyLabel(data.grossAmount)}</span>
            </div>
          </div>
        </section>

        <footer className="mt-16 grid grid-cols-3 gap-16 text-sm">
          <div className="border-t border-border pt-2 print:border-black/40 text-center">Customer</div>
          <div></div>
          <div className="border-t border-border pt-2 print:border-black/40 text-center">Sales clerk</div>
        </footer>
      </article>
    </div>
  );
}
