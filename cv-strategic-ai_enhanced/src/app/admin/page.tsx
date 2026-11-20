import Link from "next/link";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { AdminAnalyticsRepository } from "@/lib/admin/analytics-repository";
import { AdminAnalytics } from "@/components/admin/admin-analytics";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await ensureAuthSchema();
  const analytics = await new AdminAnalyticsRepository().getOverview();
  return <div className="dashboard-main admin-dashboard-main">
    <section className="admin-dashboard-welcome">
      <div><p className="eyebrow">CV STRATEGIST AI / INTELLIGENCE</p><h1>Admin overview<span>.</span></h1><p className="muted">A real-time view of platform growth, product usage and operations.</p></div>
      <div className="admin-dashboard-actions"><span className="admin-live-indicator"><i/> LIVE DATABASE</span><Link className="admin-action-button" href="/admin/users">Manage users <span>↗</span></Link></div>
    </section>
    <AdminAnalytics data={analytics}/>
    <section className="admin-shortcut-grid">
      <Link href="/admin/users" className="admin-shortcut-card"><span className="admin-shortcut-icon admin-shortcut-icon--blue">♙</span><span><strong>User management</strong><small>Accounts, roles and access controls</small></span><b>→</b></Link>
      <Link href="/admin/subscriptions" className="admin-shortcut-card"><span className="admin-shortcut-icon admin-shortcut-icon--green">↗</span><span><strong>Billing & subscriptions</strong><small>Subscription lifecycle and plan records</small></span><b>→</b></Link>
      <Link href="/admin/discounts" className="admin-shortcut-card"><span className="admin-shortcut-icon admin-shortcut-icon--amber">%</span><span><strong>Discount verification</strong><small>Review candidate discount applications</small></span><b>→</b></Link>
      <Link href="/admin/api-docs" className="admin-shortcut-card"><span className="admin-shortcut-icon admin-shortcut-icon--violet">⌘</span><span><strong>API documentation</strong><small>OpenAPI, Swagger and Postman guidance</small></span><b>→</b></Link>
    </section>
  </div>;
}