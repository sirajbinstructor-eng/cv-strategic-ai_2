import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server-session";
import { pool } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ adminPreview?: string }> }) {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/");
  const params = await searchParams;

  const profile = await pool.query(
    'SELECT account_type,is_admin FROM "user" WHERE id=$1',
    [session.user.id]
  );
  const account = profile.rows[0];
  const isAdmin = account?.is_admin === true;

  // Administrators land on the admin console. The explicit preview flag is
  // issued only by the authenticated admin journey launcher.
  if (isAdmin && params.adminPreview !== "job-seeker") redirect("/admin");
  if (account?.account_type === "recruiter" && !isAdmin) redirect("/recruiter");

  return <DashboardShell />;
}
