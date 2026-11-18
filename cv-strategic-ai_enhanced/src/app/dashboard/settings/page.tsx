import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/");
  return (
    <main className="dashboard-page">
      <header className="dashboard-header"><Link className="brand" href="/dashboard"><span className="brand-mark">CV</span><span><strong>CV Strategist</strong><small>Intelligent career positioning</small></span></Link><Link href="/dashboard" className="header-link">← Back to dashboard</Link></header>
      <div className="settings-main"><p className="eyebrow">ACCOUNT</p><h1>Account settings</h1><section className="settings-card"><h2>Profile</h2><dl><div><dt>Name</dt><dd>{session.user.name || "Not provided"}</dd></div><div><dt>Email</dt><dd>{session.user.email}</dd></div><div><dt>Email verified</dt><dd>{session.user.emailVerified ? "Yes" : "Not yet"}</dd></div><div><dt>Sign-in methods</dt><dd>Manage linked providers in a future account-security update.</dd></div></dl></section><section className="settings-card"><h2>Privacy and data</h2><p>Your uploaded CV is processed for analysis. The raw extracted CV text is kept in browser memory for the active session and is not stored in the application database. Structured analysis results and trial usage history are stored against your account.</p></section><p className="settings-note">Email verification, password reset, and provider linking will be activated when the transactional email provider is selected.</p></div>
    </main>
  );
}
