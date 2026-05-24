import { redirect } from "next/navigation";

export default function LegacyReceiveRedirect() {
  redirect("/stock/receipts");
}
