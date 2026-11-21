import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/server-session";
import { pool } from "@/lib/db";
import { RecruiterHeaderActions } from "@/components/recruiter/recruiter-header-actions";

export const dynamic = "force-dynamic";

const plans = [
  { name: "Starter", monthly: ["$49", "€46", "165 TND"], annual: ["$490", "€460", "1,650 TND"], credits: "40 / month · 480 / year", seats: "2 seats", features: ["Batch evaluation", "Standard candidate ranking", "Shared company workspace"] },
  { name: "Growth", monthly: ["$299", "€279", "999 TND"], annual: ["$2,990", "€2,790", "9,990 TND"], credits: "250 / month · 3,000 / year", seats: "5 seats", features: ["Everything in Starter", "Advanced ranking", "Workspace analytics", "Priority processing"] },
  { name: "Business", monthly: ["$899", "€839", "2,999 TND"], annual: ["$8,990", "€8,390", "29,990 TND"], credits: "800 / month · 9,600 / year", seats: "15 seats", features: ["Everything in Growth", "Advanced evaluation workflows", "Priority support"] }
];

export default async function RecruiterPricingPage() {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/");
  const profile = await pool.query('SELECT account_type FROM "user" WHERE id=$1', [session.user.id]);
  if (profile.rows[0]?.account_type !== "recruiter") redirect("/dashboard");

  return (
    <main className="dashboard-page pricing-page">
      <header className="dashboard-header">
        <Link className="brand" href="/recruiter"><span className="brand-mark">CV</span><span><strong>CV Strategist</strong><small>Company plans</small></span></Link>
        <div className="header-actions">
          <Link className="header-link" href="/recruiter">Workspace</Link>
          <RecruiterHeaderActions />
        </div>
      </header>
      <div className="pricing-main">
        <section className="pricing-hero">
          <p className="pricing-eyebrow"><span /> COMPANY & HR PLANS</p>
          <h1>Scale your hiring<br /><em>with confidence.</em></h1>
          <p className="pricing-hero-copy">Choose the company workspace capacity that matches your hiring activity. Company subscriptions and evaluation credits are separate from Job Seeker plans.</p>
          <div className="pricing-trust-row"><span><b>✓</b> Fixed USD, EUR and TND prices</span><span><b>✓</b> Shared company credits</span><span><b>✓</b> Upgrade as your team grows</span></div>
        </section>
        <div className="pricing-plan-list">
          <section className="pricing-plan-card">
            <div className="pricing-plan-heading"><div><div className="pricing-plan-kicker">GET STARTED</div><h2>Free</h2><p>Explore the company workspace with a small team.</p></div></div>
            <div className="pricing-plan-footnote"><p><strong>$0 / €0 / 0 TND</strong> · 1 seat · Free trial allowance: 3 Analysis and 1 Consulting trial, lifetime.</p></div>
          </section>
          {plans.map((plan) => (
            <section className="pricing-plan-card" key={plan.name}>
              <div className="pricing-plan-heading"><div><div className="pricing-plan-kicker">COMPANY WORKSPACE</div><h2>{plan.name}</h2><p>{plan.credits} · {plan.seats}</p></div></div>
              <div className="pricing-table-wrap">
                <table className="pricing-table"><thead><tr><th scope="col">BILLING</th><th scope="col">USD</th><th scope="col">EUR</th><th scope="col">TND</th></tr></thead>
                  <tbody><tr><th scope="row">Monthly</th>{plan.monthly.map((price)=> <td key={price}><strong>{price}</strong></td>)}</tr><tr><th scope="row">Annual</th>{plan.annual.map((price)=> <td key={price}><strong>{price}</strong></td>)}</tr></tbody>
                </table>
              </div>
              <ul className="pricing-feature-list">{plan.features.map(feature=><li key={feature}>✓ {feature}</li>)}</ul>
            </section>
          ))}
        </div>
        <section className="pricing-payment-note">
          <div className="pricing-payment-icon" aria-hidden="true">⌁</div>
          <div><h2>Ready to upgrade?</h2><p>Your company plans and prices are available to review now. Secure checkout will be enabled as soon as merchant onboarding, payment verification and settlement checks are complete. No payment will be initiated before then. Eligible companies can request the applicable one-time startup or SME discount before their first paid subscription.</p></div>
        </section>
        <footer className="pricing-footer"><span>CV Strategist AI · Company plans</span><Link href="/recruiter">← Back to company workspace</Link></footer>
      </div>
    </main>
  );
}
