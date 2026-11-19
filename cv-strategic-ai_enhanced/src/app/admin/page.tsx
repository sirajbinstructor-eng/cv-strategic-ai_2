import Link from "next/link";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { AdminUserRepository } from "@/lib/admin/repository";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  await ensureAuthSchema();
  const repo = new AdminUserRepository();
  const users = await repo.list({ role: "all", limit: 1, offset: 0 });
  const admins = await repo.list({ role: "admin", limit: 1, offset: 0 });
  return <div className="dashboard-main">
    <section className="dashboard-welcome"><div><p className="eyebrow">ADMINISTRATION</p><h1>Control centre.</h1><p className="muted">Manage accounts, roles, entitlements and discount verification.</p></div></section>
    <div className="dashboard-summary-grid"><article className="summary-tile"><span>USERS</span><strong>{users.total}</strong></article><article className="summary-tile"><span>ADMINS</span><strong>{admins.total}</strong></article><article className="summary-tile"><span>DISCOUNTS</span><strong>Manual review</strong></article></div>
    <section className="workspace-card"><h2>User management</h2><p className="muted">Search, update and safely delete accounts.</p><Link className="button-primary" href="/admin/users">Manage users →</Link></section>
    <section className="workspace-card"><h2>Subscriptions</h2><p className="muted">Inspect subscription intents, billing periods and plan status. Payment activation remains webhook-gated.</p><Link className="button-primary" href="/admin/subscriptions">View subscriptions →</Link></section>
    <section className="workspace-card"><h2>Discount verification</h2><p className="muted">Review student, recent-graduate and early-career discount applications.</p><Link className="button-primary" href="/admin/discounts">Review applications →</Link></section>
  </div>;
}