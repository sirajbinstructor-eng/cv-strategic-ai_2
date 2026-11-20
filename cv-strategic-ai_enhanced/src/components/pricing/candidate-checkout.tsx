"use client";

import { useState } from "react";
import type { BillingPlan } from "@/lib/billing/catalog";

export function CandidateCheckoutActions({ plan }: { plan: BillingPlan }) {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");
  const [currency, setCurrency] = useState<"USD" | "EUR" | "TND">("USD");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function startCheckout() {
    if (currency === "TND") {
      setMessage("TND checkout will be available through an approved Tunisian payment gateway. Paddle currently handles USD and EUR only.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ plan, interval, currency })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to start checkout.");
      if (typeof payload.checkoutUrl !== "string" || !payload.checkoutUrl.startsWith("/billing/checkout/paddle?")) {
        throw new Error("The server returned an invalid checkout destination.");
      }
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start checkout.");
      setBusy(false);
    }
  }

  return (
    <div className="workspace-card" style={{ marginTop: 18, display: "grid", gap: 12 }}>
      <h3>Purchase {plan === "pro" ? "Pro" : "Consultant"}</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Billing</span>
          <select value={interval} onChange={(event) => setInterval(event.target.value as "monthly" | "annual")} disabled={busy}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Currency</span>
          <select value={currency} onChange={(event) => setCurrency(event.target.value as "USD" | "EUR" | "TND")} disabled={busy}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="TND">TND</option>
          </select>
        </label>
        <button type="button" className="button button-primary" onClick={startCheckout} disabled={busy}>
          {busy ? "Preparing checkout…" : "Continue to secure checkout"}
        </button>
      </div>
      {message ? <p role="status" aria-live="polite" className="muted">{message}</p> : null}
      <p className="muted">The server calculates the final price and approved discount. Access is granted only after a verified provider notification.</p>
    </div>
  );
}
