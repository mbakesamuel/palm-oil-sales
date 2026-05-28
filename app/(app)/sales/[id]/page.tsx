import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth-server";
import { PrintButton } from "@/components/PrintButton";
import { SalePrint } from "@/components/SalePrint";
import Link from "next/link";
import { loadSalePrintById } from "@/app/(app)/pos/actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SaleDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  if (!id) notFound();
  const session = await getServerSession();
  if (!session) redirect("/login");

  const payload = await loadSalePrintById(id);
  if (!payload.ok) notFound();

  const { data } = payload;
  return (
    <div className="bg-white text-black -m-4 sm:-m-6 p-4 sm:p-6 rounded-2xl min-h-[calc(100%+2rem)] sm:min-h-[calc(100%+3rem)] space-y-4 print:m-0 print:p-0 print:rounded-none print:min-h-0">
      <div className="print:hidden flex items-center justify-between gap-3">
        <Link
          href="/pos"
          className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
        >
          Back to sales
        </Link>
        <PrintButton label="Print" />
      </div>

      <SalePrint
        companyName={data.companyName}
        department={data.department}
        companyPhone={data.companyPhone}
        companyAddress={data.companyAddress}
        logoSrc={data.logoSrc}
        sale={data.sale}
      />
    </div>
  );
}
