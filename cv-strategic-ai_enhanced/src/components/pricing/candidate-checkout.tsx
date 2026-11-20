"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { BillingCurrency, BillingPlan } from "@/lib/billing/catalog";
import { PLAN_CATALOG, formatPrice } from "@/lib/billing/catalog";
import { TUNISIAN_PROVIDER_PRIORITY } from "@/lib/billing/providers/types";

type ProviderId = "paddle" | "flouci" | "konnect" | "ipay" | "clictopay" | "laposte_d17" | "paymee" | "stripe";
type Provider = {
  id: ProviderId;
  name: string;
  checkoutAvailable: boolean;
  status: string;
  supportedPurposes: ("subscription" | "one_time")[];
  products: ("candidate" | "recruiter")[];
  reasons: string[];
};

const METHOD_DETAILS: Record<string, { title: string; detail: string; region: string; icon: string }> = {
  paddle: { title: "International cards", detail: "Secure hosted checkout for supported international currencies.", region: "USD · EUR", icon: "card" },
  ipay: { title: "iPay — optional aggregator", detail: "Alternative single checkout for supported local methods. May add an aggregator fee to the underlying payment cost.", region: "Tunisia · TND · fallback", icon: "local" },
  clictopay: { title: "ClicToPay / SMT", detail: "Direct bank-acquired card checkout for eligible Tunisian merchants.", region: "Tunisia · TND", icon: "bank" },
  laposte_d17: { title: "La Poste MPGS / e-Dinar", detail: "Direct postal payment integration. D17 web checkout will be offered only if La Poste confirms a supported merchant API.", region: "Tunisia · TND · direct", icon: "wallet" },
  flouci: { title: "Flouci — direct", detail: "Direct hosted wallet/card payment, subject to merchant onboarding. Automatic subscription renewal requires a separately verified recurring contract.", region: "Tunisia · TND · direct", icon: "wallet" },
  konnect: { title: "Konnect", detail: "Local payment gateway, subject to current merchant eligibility.", region: "Tunisia · TND", icon: "card" },
  paymee: { title: "Paymee", detail: "Local card checkout, subject to current merchant eligibility.", region: "Tunisia · TND", icon: "card" },
  stripe: { title: "Stripe", detail: "International card checkout where the merchant is eligible.", region: "USD · EUR", icon: "card" }
};

const styles: Record<string, CSSProperties> = {
  shell: { marginTop: 22, padding: 24, border: "1px solid var(--border, #e5e7eb)", borderRadius: 18, background: "var(--surface, #fff)", display: "grid", gap: 20 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 750, letterSpacing: ".11em", textTransform: "uppercase", color: "var(--muted, #64748b)" },
  title: { margin: "5px 0 4px", fontSize: 21, lineHeight: 1.25, fontWeight: 750, color: "var(--foreground, #111827)" },
  muted: { margin: 0, color: "var(--muted, #64748b)", fontSize: 13, lineHeight: 1.55 },
  controls: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 },
  label: { display: "grid", gap: 7, fontSize: 12, fontWeight: 650, color: "var(--foreground, #334155)" },
  select: { width: "100%", minHeight: 46, borderRadius: 10, border: "1px solid var(--border, #cbd5e1)", background: "var(--background, #fff)", color: "var(--foreground, #111827)", padding: "0 12px", font: "inherit", fontSize: 14 },
  price: { padding: "16px 18px", borderRadius: 13, background: "var(--surface-secondary, #f8fafc)", border: "1px solid var(--border, #e5e7eb)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" },
  priceValue: { fontSize: 25, fontWeight: 800, letterSpacing: "-.03em", color: "var(--foreground, #0f172a)" },
  methods: { display: "grid", gap: 10 },
  method: { display: "flex", alignItems: "center", gap: 13, padding: 14, border: "1px solid var(--border, #e5e7eb)", borderRadius: 12, background: "var(--surface, #fff)" },
  methodIcon: { width: 42, height: 42, borderRadius: 11, display: "grid", placeItems: "center", flex: "0 0 42px", background: "var(--surface-secondary, #f1f5f9)", color: "var(--foreground, #334155)", fontSize: 18, fontWeight: 800 },
  status: { marginLeft: "auto", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, color: "#64748b", background: "#f1f5f9", padding: "6px 9px", borderRadius: 999 },
  notice: { padding: 14, borderRadius: 12, background: "var(--surface-secondary, #f8fafc)", border: "1px solid var(--border, #e2e8f0)", display: "flex", alignItems: "flex-start", gap: 11 },
  button: { minHeight: 48, border: 0, borderRadius: 11, padding: "0 20px", fontSize: 14, fontWeight: 750, color: "#fff", background: "#172554", cursor: "pointer", width: "100%" },
  foot: { display: "flex", gap: 15, flexWrap: "wrap", color: "var(--muted, #64748b)", fontSize: 11 }
};

export function CandidateCheckoutActions({ plan }: { plan: BillingPlan }) {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [currency, setCurrency] = useState<BillingCurrency>("USD");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "info">("info");

  useEffect(() => {
    let active = true;
    fetch("/api/billing/providers", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Payment availability could not be checked.");
        return response.json();
      })
      .then(payload => {
        if (active && Array.isArray(payload.providers)) setProviders(payload.providers);
      })
      .catch(() => {
        if (active) setMessage("We couldn't verify payment availability just now. Please try again shortly; you won't be charged by refreshing this page.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const price = PLAN_CATALOG[plan][interval][currency];
  const availableProviders = useMemo(() => providers.filter(p => p.checkoutAvailable && p.products.includes("candidate") && p.supportedPurposes.includes("subscription")), [providers]);
  const relevantProviders = useMemo(() => {
    if (currency === "TND") {
      const byId = new Map(providers.map(provider => [provider.id, provider]));
      return TUNISIAN_PROVIDER_PRIORITY.map(id => byId.get(id)).filter((provider): provider is Provider => Boolean(provider));
    }
    return providers.filter(p => p.id === "paddle" || (p.checkoutAvailable && p.id === "stripe"));
  }, [providers, currency]);
  const readyProvider = currency === "TND"
    ? TUNISIAN_PROVIDER_PRIORITY
        .map(id => availableProviders.find(provider => provider.id === id))
        .find((provider): provider is Provider => Boolean(provider))
    : availableProviders.find(provider => provider.id === "paddle");
  const canStart = Boolean(readyProvider && readyProvider.id === "paddle" && currency !== "TND");

  async function startCheckout() {
    if (!canStart) return;
    setBusy(true); setMessage(""); setMessageKind("info");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval, currency })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to start checkout.");
      if (typeof payload.checkoutUrl !== "string" || !payload.checkoutUrl.startsWith("/billing/checkout/paddle?")) {
        throw new Error("The secure checkout destination was not valid. No payment was taken.");
      }
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start checkout. No payment was taken.");
      setMessageKind("error"); setBusy(false);
    }
  }

  const methodLabel = currency === "TND" ? "Tunisian payment options" : "International payment options";

  return (
    <section aria-labelledby={`checkout-title-${plan}`} style={styles.shell}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>SECURE CHECKOUT</p>
          <h3 id={`checkout-title-${plan}`} style={styles.title}>Get started with {plan === "pro" ? "Pro" : "Consultant"}</h3>
          <p style={styles.muted}>Choose your billing preference. We'll clearly distinguish available payment methods from those still being onboarded.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--muted, #64748b)", fontSize: 11, fontWeight: 650 }}>
          <span aria-hidden="true">▣</span> Secure payment · No card details stored here
        </div>
      </div>

      <div style={styles.controls}>
        <label style={styles.label}>Billing frequency
          <select style={styles.select} value={interval} onChange={e => setInterval(e.target.value as "monthly" | "annual")} disabled={busy}>
            <option value="monthly">Monthly</option><option value="annual">Annual</option>
          </select>
        </label>
        <label style={styles.label}>Payment currency
          <select style={styles.select} value={currency} onChange={e => { setCurrency(e.target.value as BillingCurrency); setMessage(""); }} disabled={busy}>
            <option value="TND">TND — Tunisian dinar</option><option value="EUR">EUR — Euro</option><option value="USD">USD — US dollar</option>
          </select>
        </label>
      </div>

      <div style={styles.price} aria-live="polite">
        <div><p style={styles.eyebrow}>YOUR SELECTED PLAN</p><p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700 }}>{plan === "pro" ? "Pro" : "Consultant"} · {interval === "monthly" ? "Monthly billing" : "Annual billing"}</p></div>
        <div style={{ textAlign: "right" }}><div style={styles.priceValue}>{formatPrice(price)}</div><p style={styles.muted}>{interval === "monthly" ? "per month" : "per year"} · {currency}</p></div>
      </div>

      <div style={styles.methods}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <strong style={{ fontSize: 13 }}>{methodLabel}</strong>
          <span style={{ fontSize: 11, color: "var(--muted, #64748b)" }}>{loading ? "Checking availability…" : "Live availability"}</span>
        </div>
        {loading ? <div aria-label="Loading payment methods" style={{ display: "grid", gap: 9 }}><div style={{ height: 68, borderRadius: 12, background: "var(--surface-secondary, #f1f5f9)" }} /><div style={{ height: 68, borderRadius: 12, background: "var(--surface-secondary, #f1f5f9)" }} /></div> :
          relevantProviders.length ? relevantProviders.map(provider => {
            const details = METHOD_DETAILS[provider.id];
            const ready = provider.checkoutAvailable;
            return <div key={provider.id} style={{ ...styles.method, opacity: ready ? 1 : .78, borderColor: ready ? "#16a34a" : "var(--border, #e5e7eb)" }}>
              <div aria-hidden="true" style={styles.methodIcon}>{details.icon === "card" ? "▤" : details.icon === "bank" ? "⌂" : details.icon === "wallet" ? "▣" : "↗"}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 750, color: "var(--foreground, #111827)" }}>{details.title}</div>
                <div style={{ ...styles.muted, marginTop: 3 }}>{details.detail}</div>
                <div style={{ ...styles.muted, marginTop: 3, fontSize: 11 }}>{details.region}</div>
              </div>
              <span style={{ ...styles.status, color: ready ? "#166534" : "#64748b", background: ready ? "#dcfce7" : "#f1f5f9" }}>{ready ? "Available" : "Coming soon"}</span>
            </div>;
          }) : <p style={styles.muted}>No payment method is currently listed for this currency.</p>}
      </div>

      {!loading && !readyProvider ? <div role="status" style={styles.notice}>
        <span aria-hidden="true" style={{ fontSize: 19 }}>ⓘ</span>
        <div><strong style={{ display: "block", fontSize: 13, marginBottom: 3 }}>Secure checkout is being prepared</strong>
          <p style={styles.muted}>{currency === "TND" ? "We're completing merchant onboarding and payment verification for Tunisian methods. You can review your plan now; payment will become available once the gateway is approved and tested." : "International checkout is not yet open for customer payments. We're completing provider verification before accepting payments."} You won't be charged, and no payment details are requested at this stage.</p>
        </div>
      </div> : null}

      {canStart ? <button type="button" style={{ ...styles.button, opacity: busy ? .7 : 1 }} onClick={startCheckout} disabled={busy}>{busy ? "Preparing secure checkout…" : "Continue to secure payment"}</button> :
        <button type="button" style={{ ...styles.button, opacity: .48, cursor: "not-allowed" }} disabled>{loading ? "Checking secure payment options…" : "Secure payment not available yet"}</button>}

      {message ? <p role="alert" aria-live="polite" style={{ ...styles.muted, color: messageKind === "error" ? "#b91c1c" : "inherit" }}>{message}</p> : null}
      <div style={styles.foot}><span>✓ Prices confirmed before payment</span><span>✓ Payment verified server-side</span><span>✓ No card data stored by CV Strategist AI</span></div>
    </section>
  );
}
