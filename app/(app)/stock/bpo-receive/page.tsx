import { redirect } from "next/navigation";

export default function LegacyBpoReceiveRedirect() {
  redirect("/stock/receipts#bottled");
}
