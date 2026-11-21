import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminHeaderActions } from "@/components/admin/admin-header-actions";
import { getCurrentSession } from "@/lib/server-session";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/");
  if (!(session.user as typeof session.user & { isAdmin?: boolean }).isAdmin) redirect("/dashboard");
  return <main className="dashboard-page admin-shell">
    <header className="dashboard-header admin-header">
      <Link className="brand" href="/admin"><span className="brand-mark">CV</span><span><strong>CV Strategist <i>·</i> Admin</strong><small>Platform intelligence</small></span></Link>
      <nav className="admin-header-nav" aria-label="Administration">
        <Link href="/admin" className="admin-nav-link">Overview</Link><Link href="/admin/users" className="admin-nav-link">Users</Link><Link href="/admin/subscriptions" className="admin-nav-link">Billing</Link><Link href="/admin/discounts" className="admin-nav-link">Discounts</Link><Link href="/admin/api-docs" className="admin-nav-link">API docs</Link>
      </nav>
      <div className="header-actions">
        <Link href="/admin" className="admin-workspace-link">Admin home</Link>
        <AdminHeaderActions />
      </div>
    </header>
    {children}
  </main>;
}