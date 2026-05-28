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
    <div className="bg-white text-black -m-4 sm:-m-6 p-4 sm:p-6 rounded-2xl min-h-[calc(100%+2rem)] sm:min-h-[calc(100%+3rem)] space-y-6 print:m-0 print:p-0 print:rounded-none print:min-h-0">
      <div className="print:hidden flex flex-wrap justify-between items-center gap-3">
        <Link
          href="/consignment-notes"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          ← Back
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
