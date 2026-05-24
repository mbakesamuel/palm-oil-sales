import { redirect } from "next/navigation";

export default function LegacyOutboundRedirect() {
  redirect("/stock/issues");
}
