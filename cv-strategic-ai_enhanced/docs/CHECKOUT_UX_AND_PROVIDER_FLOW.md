# Checkout UX and payment-provider flow

## Customer experience goals

The checkout flow is deliberately calm and low-friction:
- Show the selected plan, billing frequency, currency and fixed catalogue price together before payment.
- Check provider readiness from the server; never show an unavailable provider as selectable.
- Keep the first Tunisian route focused on iPay. Direct ClicToPay/SMT and La Poste/D17 are fallback integrations and are shown only when they are genuinely checkout-ready.
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

1. iPay aggregator first, after its authenticated merchant API pack and sandbox are obtained.
2. Direct ClicToPay / SMT as a separate alternative, after bank onboarding and SMT test certification.
3. Direct La Poste / e-Dinar / D17 only after La Poste confirms the supported merchant flow and provides its official kit.

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
