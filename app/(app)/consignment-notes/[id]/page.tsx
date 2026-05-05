import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";
import { ConsignmentNotePrint } from "@/components/ConsignmentNotePrint";
import { loadConsignmentPrintById } from "../actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function ConsignmentNotePrintPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!id?.trim()) notFound();

  const session = await getServerSession();
  if (!session) redirect("/login");

  const payload = await loadConsignmentPrintById(id.trim());
  if (!payload.ok) notFound();

  const { data } = payload;
  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center gap-3">
        <Link
          href="/consignment-notes"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          ← Consignment notes
        </Link>
        <PrintButton label="Print" />
      </div>

      <ConsignmentNotePrint
        companyName={data.companyName}
        department={data.department}
        companyPhone={data.companyPhone}
        companyAddress={data.companyAddress}
        logoSrc={data.logoSrc}
        note={data.note}
      />
    </div>
  );
}
