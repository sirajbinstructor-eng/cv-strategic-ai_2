import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server-session";
import { pool } from "@/lib/db";
import { RecruiterWorkspaceClient } from "@/components/recruiter/recruiter-workspace";

export const dynamic = "force-dynamic";

export default async function RecruiterPage() {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/");
  const profile = await pool.query('SELECT account_type,is_admin FROM "user" WHERE id=$1',[session.user.id]);
  const isAdmin = profile.rows[0]?.is_admin === true;
  if (profile.rows[0]?.account_type !== "recruiter") redirect("/dashboard");

  return (
    <main className="dashboard-page recruiter-page">
      <header className="dashboard-header">
        <Link className="brand" href="/recruiter"><span className="brand-mark">CV</span><span><strong>CV Strategist</strong><small>Company workspace</small></span></Link>
        <div className="header-actions">
          {isAdmin && <Link className="header-link" href="/admin">Admin dashboard</Link>}
        </div>
      </header>
      <div className="dashboard-main recruiter-dashboard-main">
        <RecruiterWorkspaceClient />
        <footer className="dashboard-footer"><span>CV Strategist AI · Company workspace</span>{isAdmin && <Link href="/admin">Return to Admin Dashboard</Link>}</footer>
      </div>
    </main>
  );
}
