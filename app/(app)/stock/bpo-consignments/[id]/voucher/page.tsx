import { redirect } from "next/navigation";

export default async function LegacyVoucherRedirect(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  redirect(`/stock/movements/${id}/voucher`);
}
