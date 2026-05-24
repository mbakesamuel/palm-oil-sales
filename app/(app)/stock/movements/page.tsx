import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function StockMovementsRedirect() {
  redirect("/stock?mode=transfer");
}
