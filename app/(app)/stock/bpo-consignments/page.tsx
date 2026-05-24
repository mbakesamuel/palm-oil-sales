import { redirect } from "next/navigation";

export default function LegacyConsignmentsRedirect() {
  redirect("/stock/movements");
}
