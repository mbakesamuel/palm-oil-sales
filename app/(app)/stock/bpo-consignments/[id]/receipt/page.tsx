import { redirect } from "next/navigation";

export default async function LegacyReceiptRedirect(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  redirect(`/stock/movements/${id}/receipt`);
}
