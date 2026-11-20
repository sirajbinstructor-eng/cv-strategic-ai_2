# Checkout UX and payment-provider flow

## Customer experience goals

The checkout flow is deliberately calm and low-friction:
- Show the selected plan, billing frequency, currency and fixed catalogue price together before payment.
- Check provider readiness from the server; never show an unavailable provider as selectable.
- Prioritize direct Tunisian integrations: Flouci first for supported one-time payments, then direct ClicToPay/SMT and La Poste MPGS/D17 when their official merchant APIs are available. Keep iPay as an explicitly labelled optional aggregator fallback, not the default route.
- Do not ask the customer for card, wallet, bank or identity details on CV Strategist AI pages.
- Use the provider's hosted payment experience when an adapter is enabled.
- Explain a temporary unavailable state in one concise message, without implying that a payment attempt was made.
- Provide accessible labels, live status announcements, disabled/loading states and clear error recovery.

## Current routes

| Route | Purpose |
|---|---|
| `GET /api/billing/providers` | Public, non-sensitive provider readiness for the checkout UI. Never returns credentials. |
| `POST /api/billing/checkout` | Authenticated candidate subscription checkout. Currently dispatches only to the existing Paddle adapter. Rejects explicit non-Paddle provider requests. |
| `GET /api/billing/checkout/status` | Reads the current user's locally verified payment/subscription state. |
| `POST /api/billing/webhooks/[provider]` | Provider callback endpoint. Only Paddle has a verified event adapter today; unsupported providers fail closed. |

## Tunisian provider order

1. Direct Flouci for one-time TND payments, after merchant approval and adapter verification. The public one-time API must not be used for automatic monthly/annual renewals; its recurring contract is not yet fully documented.
2. Direct ClicToPay / SMT after bank onboarding, official merchant integration pack and SMT certification.
3. Direct La Poste MPGS; D17 is shown only if La Poste confirms a supported web merchant API and supplies its integration kit.
4. iPay by Audasoft as an optional aggregator fallback. Label it clearly as an aggregator; disclose any additional fees confirmed by the merchant contract. Never silently route a failed direct payment through iPay.

The supplied iPay merchant documentation confirms the create-oneshot request/response and webhook event payload, but does not document callback signature/authentication or a trusted transaction-status lookup. It also says failed webhook delivery is not retried and that transaction.completed can include manually declared bank transfers or postal mandates. Therefore iPay remains unavailable for automatic entitlement grants until those security and settlement questions are resolved.

The UI does not imply that a method is live merely because it appears in the provider catalogue. The readiness registry must confirm an implemented adapter, merchant approval, complete server credentials and the required verification gates.

## iPay documentation distinction

The integration target is **iPay by Audasoft at https://www.ipay.tn/**. Do not use the similarly named `docs.i-pay.io` service; it documents a different product and payment model.

The public iPay by Audasoft pages describe one-shot transactions, callback events and an authenticated merchant dashboard for complete technical details. Before implementing requests, obtain the exact merchant endpoint schemas, authentication rules, callback authenticity mechanism, status-query endpoint, recurring-payment lifecycle, refund support and sandbox credentials from iPay.

## Security and activation

- Keep all Tunisian provider enablement flags unset/false.
- No payment is successful because the browser returns to a success URL.
- Grant entitlements only after authenticated server-to-server confirmation and a server-side status/amount/currency/reference match.
- Persist idempotency and event identifiers; reject duplicate or replayed callbacks.
- Do not store PAN/CVV or wallet credentials.
- Do not add secrets to client-side environment variables or Git.
- Do not enable a provider until merchant approval, payout settlement, sandbox tests and operational reconciliation are verified.


## Public Tunisian API research update (20 November 2026)

See [Tunisian payment integrations](./TUNISIAN_PAYMENT_INTEGRATIONS.md) for the detailed public API research and provider-specific readiness gates.

Key implementation constraints:
- Direct Flouci is the first one-time integration priority; its public API documents HMAC-SHA256 webhook verification and server-side payment verification, but not the complete automatic recurring lifecycle.
- Direct ClicToPay/SMT and La Poste MPGS/D17 follow when official merchant integration packs and certification are supplied.
- iPay is an optional aggregator fallback. The supplied merchant documentation confirms JWT + X-Org-Id, create-oneshot request/response, invoices and webhook payloads, but does not document webhook authentication or a trusted status lookup. No automatic entitlement grant is permitted from transaction.completed alone.
- Flouci publicly documents hosted payment creation, HMAC-SHA256 signed v2 webhooks and server-side payment verification. Its binding charge requires a CVC and is partner-restricted; unattended recurring details remain incomplete publicly.
- Konnect publicly documents one-time payment creation, webhook reference lookup, server-side payment details and sandbox. It is not treated as an automatic subscription provider until its recurring lifecycle contract is verified.
- Direct ClicToPay/SMT and La Poste MPGS/D17 require official merchant technical packs and onboarding/certification.
- Paymee's public integration page is older and requires current merchant/security confirmation.

The checkout and billing services must never interpret a one-time payment as a recurring subscription. All Tunisian providers remain disabled until the adapter, merchant approval, credentials, sandbox, settlement and reconciliation gates are complete.
