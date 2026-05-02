import { getServerSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  redirect("/dashboard");
}
