"use client";

import Script from "next/script";
import { useCallback, useState } from "react";

declare global {
  interface Window {
    Paddle?: {
      Environment: { set(environment: "sandbox"): void };
      Initialize(options: { token: string; eventCallback?: (event: { name?: string }) => void }): void;
      Checkout: { open(options: { transactionId: string }): void };
    };
  }
}

export function PaddleCheckout({ transactionId, clientToken, environment }: {
  transactionId: string; clientToken: string; environment: "sandbox" | "live";
}) {
  const [status, setStatus] = useState("Loading Paddle's secure checkout…");
  const [opened, setOpened] = useState(false);
  const initialize = useCallback(() => {
    if (!window.Paddle || opened) return;
    try {
      if (environment === "sandbox") window.Paddle.Environment.set("sandbox");
      window.Paddle.Initialize({
        token: clientToken,
        eventCallback: (event) => {
          if (event.name === "checkout.completed") {
            setStatus("Payment submitted. We are waiting for Paddle's verified confirmation before activating your subscription.");
          } else if (event.name === "checkout.closed") {
            setStatus("Checkout closed. If you completed payment, your subscription will activate after Paddle confirms it.");
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
        <p>{status}</p>
        <p className="muted">Your account is updated only after our server verifies Paddle's signed payment notification. A browser redirect or checkout message alone never grants access.</p>
        <a className="button button-secondary" href="/pricing">Return to pricing</a>
      </div>
    </main>
  );
}
