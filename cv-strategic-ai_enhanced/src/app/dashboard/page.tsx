import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server-session";
import { pool } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/");

  // A regular HR/company account belongs directly in the company product.
  // Only administrators retain the cross-product workspace selector.
  const profile = await pool.query(
    'SELECT account_type,is_admin FROM "user" WHERE id=$1',
    [session.user.id]
  );
  const account = profile.rows[0];
  if (account?.account_type === "recruiter" && account.is_admin !== true) {
    redirect("/recruiter");
  }

  return <DashboardShell />;
}
