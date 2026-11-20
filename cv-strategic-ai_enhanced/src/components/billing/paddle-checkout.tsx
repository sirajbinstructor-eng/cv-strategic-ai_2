"use client";

import Script from "next/script";
import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    Paddle?: {
      Environment: { set(environment: "sandbox"): void };
      Initialize(options: { token: string; eventCallback?: (event: { name?: string }) => void }): void;
      Checkout: { open(options: { transactionId: string }): void };
    };
  }
}

export function PaddleCheckout({ transactionId, clientToken, environment, initialCompleted = false }: {
  transactionId: string; clientToken: string; environment: "sandbox" | "live"; initialCompleted?: boolean;
}) {
  const [status, setStatus] = useState(initialCompleted ? "Payment received. Checking subscription confirmation…" : "Loading Paddle's secure checkout…");
  const [opened, setOpened] = useState(initialCompleted);
  const [checkoutCompleted, setCheckoutCompleted] = useState(initialCompleted);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [confirmationTimedOut, setConfirmationTimedOut] = useState(false);

  useEffect(() => {
    if (!checkoutCompleted || paymentConfirmed) return;
    let active = true;
    let inFlight = false;
    let attempts = 0;
    const checkStatus = async () => {
      if (!active || inFlight || paymentConfirmed) return;
      inFlight = true;
      attempts += 1;
      try {
        const response = await fetch(`/api/billing/checkout/status?transactionId=${encodeURIComponent(transactionId)}`, { cache: "no-store" });
        if (response.ok) {
          const result = await response.json();
          if (active && result.subscriptionStatus === "active" && result.paymentStatus === "paid") {
            setPaymentConfirmed(true);
            setStatus("Payment confirmed. Your subscription is now active.");
            return;
          }
          if (active && ["expired","refunded","disputed"].includes(result.subscriptionStatus)) {
            setStatus("The payment did not activate this subscription. Please contact support before trying again.");
            setConfirmationTimedOut(true);
            active = false;
            return;
          }
        }
      } catch {
        // A temporary status endpoint failure must not be mistaken for payment failure.
      } finally {
        inFlight = false;
      }
      if (active && attempts >= 30) {
        setConfirmationTimedOut(true);
        setStatus("Paddle reported checkout completion, but confirmation is still pending. You can check your dashboard again shortly.");
        active = false;
      }
    };
    void checkStatus();
    const timer = window.setInterval(() => { void checkStatus(); }, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [checkoutCompleted, paymentConfirmed, transactionId]);

  const initialize = useCallback(() => {
    if (!window.Paddle || opened) return;
    try {
      if (environment === "sandbox") window.Paddle.Environment.set("sandbox");
      window.Paddle.Initialize({
        token: clientToken,
        eventCallback: (event) => {
          if (event.name === "checkout.completed") {
            setCheckoutCompleted(true);
            setStatus("Payment submitted. Waiting for Paddle's signed confirmation…");
          } else if (event.name === "checkout.closed") {
            setCheckoutCompleted(true);
            setStatus("Checkout closed. Checking whether a payment was completed…");
          }
        }
      });
      window.Paddle.Checkout.open({ transactionId });
      setOpened(true);
      setStatus("Complete your payment in Paddle's secure checkout.");
    } catch {
      setStatus("Paddle checkout could not be opened. Return to pricing and try again.");
    }
  }, [clientToken, environment, opened, transactionId]);

  return (
    <main className="marketing-page">
      <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" strategy="afterInteractive" onLoad={initialize} />
      <div className="marketing-content" style={{ maxWidth: 760, margin: "0 auto", paddingTop: 80 }}>
        <p className="eyebrow">SECURE PAYMENT</p>
        <h1>Complete your subscription</h1>
        <p role="status" aria-live="polite">{status}</p>
        <p className="muted">Your account is updated only after our server verifies Paddle's signed payment notification. A browser redirect or checkout message alone never grants access.</p>
        {paymentConfirmed || confirmationTimedOut ? <a className="button button-primary" href="/dashboard">Go to dashboard</a> : null}
        <a className="button button-secondary" href="/pricing">Return to pricing</a>
      </div>
    </main>
  );
}
