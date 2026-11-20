import Link from "next/link";
import { PLAN_CATALOG, PLAN_QUOTAS, formatPrice, type BillingCurrency, type BillingPlan, type BillingInterval } from "@/lib/billing/catalog";
import { CandidateCheckoutActions } from "@/components/pricing/candidate-checkout";

export const dynamic = "force-dynamic";

const currencies: BillingCurrency[] = ["USD", "EUR", "TND"];
const plans: BillingPlan[] = ["pro", "consultant"];
const intervals: BillingInterval[] = ["monthly", "annual"];
const currencyLabels: Record<BillingCurrency, { label: string; flag: string }> = {
  USD: { label: "US dollar", flag: "🇺🇸" },
  EUR: { label: "Euro", flag: "🇪🇺" },
  TND: { label: "Tunisian dinar", flag: "🇹🇳" }
};

function PricingComparison({ plan }: { plan: BillingPlan }) {
  const isPro = plan === "pro";
  return (
    <section className={`pricing-plan-card pricing-plan-card--${plan}`} aria-labelledby={`plan-title-${plan}`}>
      <div className="pricing-plan-heading">
        <div>
          <div className="pricing-plan-kicker">{isPro ? "FOR INDIVIDUAL CANDIDATES" : "FOR HIGH-VOLUME PROFESSIONALS"}</div>
          <h2 id={`plan-title-${plan}`}>{isPro ? "Pro" : "Consultant"}</h2>
          <p>{isPro ? "For individual candidates working on several opportunities." : "For high-volume candidates and professional career support."}</p>
        </div>
        <div className={`pricing-plan-icon pricing-plan-icon--${plan}`} aria-hidden="true">{isPro ? "✦" : "◆"}</div>
      </div>

      <div className="pricing-table-wrap">
        <table className="pricing-table">
          <thead>
            <tr>
              <th scope="col" className="pricing-table-plan-col">BILLING</th>
              <th scope="col">INCLUDED CAPACITY</th>
              {currencies.map(currency => (
                <th scope="col" key={currency}>
                  <span className="pricing-currency-flag" aria-hidden="true">{currencyLabels[currency].flag}</span>
                  <span>{currency}</span>
                  <small>{currencyLabels[currency].label}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {intervals.map(interval => {
              const quota = PLAN_QUOTAS[plan][interval];
              const annual = interval === "annual";
              return (
                <tr key={interval} className={annual ? "pricing-row-annual" : "pricing-row-monthly"}>
                  <th scope="row" className="pricing-billing-cell">
                    <span className="pricing-billing-name">{annual ? "Annual" : "Monthly"}</span>
                    {annual
                      ? <span className="pricing-value-tag">BEST VALUE · SAVE ~17%</span>
                      : <span className="pricing-billing-note">Flexible billing</span>}
                  </th>
                  <td className="pricing-capacity-cell">
                    <div className="pricing-quota-pair">
                      <div className="pricing-quota">
                        <span className="pricing-quota-icon pricing-quota-icon--blue" aria-hidden="true">⌕</span>
                        <span><strong>{quota.analyses.toLocaleString("en-US")}</strong><small>Analyses</small></span>
                      </div>
                      <div className="pricing-quota">
                        <span className="pricing-quota-icon pricing-quota-icon--violet" aria-hidden="true">▤</span>
                        <span><strong>{quota.generations.toLocaleString("en-US")}</strong><small>CV generations</small></span>
                      </div>
                    </div>
                    {annual && <span className="pricing-upfront-note">Full quota available upfront</span>}
                  </td>
                  {currencies.map(currency => (
                    <td key={currency} className="pricing-price-cell">
                      <strong>{formatPrice(PLAN_CATALOG[plan][interval][currency])}</strong>
                      <small>{annual ? "per year" : "per month"}</small>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="pricing-plan-footnote">
        <span className="pricing-footnote-icon" aria-hidden="true">ⓘ</span>
        <p>{isPro
          ? "Annual Pro includes 300 analyses and 250 CV generations, allocated at the start of your billing year. Unused annual quota does not roll over."
          : "Annual Consultant includes 1,300 analyses and 1,300 CV generations, allocated at the start of your billing year. Unused annual quota does not roll over."}</p>
      </div>
      <div className="pricing-plan-action">
        <span>Ready when you are</span>
        <a href={`#checkout-${plan}`} className="pricing-choose-link">Choose {isPro ? "Pro" : "Consultant"} <span aria-hidden="true">→</span></a>
      </div>
      <div id={`checkout-${plan}`} className="pricing-checkout-anchor">
        <CandidateCheckoutActions plan={plan} />
      </div>
    </section>
  );
}

export default function PricingPage() {
  return (
    <main className="dashboard-page pricing-page">
      <header className="dashboard-header">
        <Link className="brand" href="/">
          <span className="brand-mark">CV</span>
          <span><strong>CV Strategist</strong><small>Plans and pricing</small></span>
        </Link>
        <div className="header-actions">
          <Link className="header-link" href="/dashboard">Dashboard</Link>
          <Link className="header-link" href="/">Sign in</Link>
        </div>
      </header>

      <div className="pricing-main">
        <section className="pricing-hero">
          <div className="pricing-hero-orbit" aria-hidden="true"><span>✦</span><i /><b /></div>
          <p className="pricing-eyebrow"><span /> SIMPLE, FIXED PRICING</p>
          <h1>Invest in your next<br /><em>career move.</em></h1>
          <p className="pricing-hero-copy">Choose the support that matches your ambition. Clear limits, transparent prices, and no surprise currency conversions.</p>
          <div className="pricing-trust-row">
            <span><b>✓</b> Fixed prices in each currency</span>
            <span><b>✓</b> Secure, verified payments</span>
            <span><b>✓</b> Upgrade when you need more</span>
          </div>
        </section>

        <div className="pricing-plan-list">
          {plans.map(plan => <PricingComparison key={plan} plan={plan} />)}
        </div>

        <section className="pricing-discounts">
          <div className="pricing-discount-mark" aria-hidden="true">%</div>
          <div>
            <p className="pricing-section-kicker">A LITTLE HELP GETTING STARTED</p>
            <h2>Eligible for a discount?</h2>
            <p>Approved early-career applicants receive 10%; eligible non-Tunisian students and recent graduates receive 20%; eligible Tunisian students and recent graduates receive 40%. Discounts are mutually exclusive and applied by the server after approval. Student and recent-graduate verification is temporarily paused while secure document uploads are being prepared.</p>
          </div>
        </section>

        <section className="pricing-payment-note">
          <div className="pricing-payment-icon" aria-hidden="true">⌁</div>
          <div>
            <h2>Payments that fit your location</h2>
            <p>Payment options will appear only when merchant approval, integration checks and end-to-end testing are complete. We are prioritizing direct Tunisian payment methods, with iPay as an optional alternative. International checkout is handled separately. CV Strategist AI never stores your card details.</p>
          </div>
        </section>
        <footer className="pricing-footer">
          <span>CV Strategist AI</span>
          <span>Transparent pricing. No hidden conversions.</span>
          <Link href="/dashboard">← Back to dashboard</Link>
        </footer>
      </div>
    </main>
  );
}
