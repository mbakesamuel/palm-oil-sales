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
    <div className="space-y-4 bg-white p-4 rounded-lg">
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
        sale={data.sale}
      />
    </div>
  );
}
