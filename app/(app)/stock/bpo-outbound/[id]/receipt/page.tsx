import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function LegacyBpoOutboundReceiptRedirect(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  redirect(`/bpo-sales/${encodeURIComponent(id)}/receipt`);
}
