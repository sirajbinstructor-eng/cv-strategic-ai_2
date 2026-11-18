import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server-session";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/");
  return <DashboardShell />;
}
