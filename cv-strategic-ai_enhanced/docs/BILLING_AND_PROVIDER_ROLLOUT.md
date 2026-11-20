# Billing and payment-provider rollout

## Commercial boundaries

Candidate and recruiter billing are separate products.

- Candidate subscriptions retain the existing Pro and Consultant prices, discounts, analysis quotas and CV-generation quotas.
- Recruiter subscriptions belong to a company workspace, not an individual member.
- Recruiter evaluation credits are metered independently from candidate analysis/generation quotas.
- One recruiter evaluation credit represents one distinct CV assessed against one job description.
- Premium batch matching is a separate feature entitlement. Credits alone do not unlock it.
- A premium batch supports up to 10 CVs, up to 5 job descriptions per CV and up to 50 distinct CV/job pairs. Only pairs actually submitted for evaluation consume credits.

Recruiter prices, seat allowances and included credit quantities remain unpriced until the commercial catalogue is approved.

## Provider architecture

Provider metadata, readiness checks and provider adapters are separate modules. A provider must satisfy every condition below before checkout can be enabled:

1. The business has completed merchant onboarding and approval.
2. Provider credentials and webhook secrets are configured in the hosting environment.
3. The provider is explicitly enabled by a server-side feature flag.
4. A provider-specific adapter is implemented against current official documentation.
5. Webhook signatures, idempotency, amount/currency/reference checks and replay handling pass tests.
6. Sandbox checkout, successful payment, failed payment, refund, dispute and subscription lifecycle tests pass.
7. Payout and settlement arrangements have been verified for the actual legal merchant.

All providers are disabled by default. The readiness endpoint never exposes credentials. No browser redirect may grant access. Only a verified provider event or trusted server-side status verification can change payment state or grant entitlements.

## Provider onboarding checklist

| Provider | Intended role | Required verification before activation |
| --- | --- | --- |
| Paddle | International SaaS Merchant of Record | Tunisian merchant acceptance, payout route, currencies, subscription and one-time product setup, webhook contract |
| Flouci | Tunisian checkout | Merchant approval, local/international card coverage, recurring support, settlement and signed webhook contract |
| Konnect | Tunisian checkout | Merchant approval, supported currencies, recurring support; one-time use until recurring is verified |
| iPay | Additional Tunisian checkout | Merchant approval, current API documentation, recurring support, settlement and webhook security |
| Paymee | Additional Tunisian checkout | Merchant approval, current API documentation, supported currencies and webhook security |
| Stripe | Future route only if a genuinely eligible legal entity exists | Entity, tax, physical presence, bank and merchant eligibility in a Stripe-supported country |
| PayPal | Customer payment method only through an eligible, approved checkout arrangement | Explicit confirmation that the selected provider supports PayPal for this merchant and transaction |
| Payoneer | Potential payout/receiving route, not a card checkout adapter | Account approval, supported receiving route, bank and foreign-exchange compliance |

The presence of a provider in this table does not mean it is integrated, approved or available to customers.

## Required environment variables

Provider credentials must be configured in the deployment platform, never committed to source control or pasted into chat.

- Paddle sandbox: set `PADDLE_ENVIRONMENT=sandbox`, `BILLING_PADDLE_SANDBOX_ENABLED=true`, and `BILLING_PROVIDER_PADDLE_ENABLED=true`; configure `PADDLE_API_KEY` (sandbox key), `PADDLE_WEBHOOK_SECRET`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`, and the eight `PADDLE_PRICE_{PRO|CONSULTANT}_{MONTHLY|ANNUAL}_{USD|EUR}` price IDs. Configure `PADDLE_DISCOUNT_10_ID`, `PADDLE_DISCOUNT_20_ID` and `PADDLE_DISCOUNT_40_ID` for approved recurring discounts.
- Paddle live: additionally require `PADDLE_ENVIRONMENT=live`, `BILLING_PADDLE_MERCHANT_APPROVED=true` and `BILLING_PADDLE_SANDBOX_VERIFIED=true`. Replace the sandbox API key, client token, webhook destination secret, all eight price IDs and three discount IDs with their live-environment equivalents, then redeploy.
- Flouci: `FLOUCI_APP_TOKEN`, `FLOUCI_APP_SECRET`, `FLOUCI_WEBHOOK_SECRET`, `BILLING_FLOUCI_MERCHANT_APPROVED=true`, `BILLING_PROVIDER_FLOUCI_ENABLED=true`
- Konnect: `KONNECT_API_KEY`, `KONNECT_WEBHOOK_SECRET`, `BILLING_KONNECT_MERCHANT_APPROVED=true`, `BILLING_PROVIDER_KONNECT_ENABLED=true`
- iPay: `IPAY_API_KEY`, `IPAY_WEBHOOK_SECRET`, `BILLING_IPAY_MERCHANT_APPROVED=true`, `BILLING_PROVIDER_IPAY_ENABLED=true`
- Paymee: `PAYMEE_API_KEY`, `PAYMEE_WEBHOOK_SECRET`, `BILLING_PAYMEE_MERCHANT_APPROVED=true`, `BILLING_PROVIDER_PAYMEE_ENABLED=true`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BILLING_STRIPE_MERCHANT_APPROVED=true`, `BILLING_PROVIDER_STRIPE_ENABLED=true`

The Paddle adapter supports candidate subscriptions in USD/EUR only. Paddle Checkout can offer PayPal as a buyer payment method where Paddle enables it for the merchant account and buyer country; this is not a separately integrated PayPal merchant account and is not guaranteed for every checkout. TND remains reserved for an approved Tunisian gateway. Paddle price IDs must match the exact server-owned base amount and billing interval. The application uses Paddle.js with a public client-side token; the API key and webhook secret remain server-only. Sandbox checkout is explicitly gated and restricted to authorized administrators for integration testing; it is not a production payment option. Live checkout remains blocked until merchant approval and sandbox verification.

For Paddle, create the sandbox catalog first: two candidate products (Pro and Consultant), each with monthly/annual recurring prices in USD/EUR. Price IDs must map exactly to the fixed catalogue values. Create three percentage discounts (10%, 20%, 40%) with checkout enabled, recurring forever (`recur=true`, `maximum_recurring_intervals=null`), no expiry, and restrictions covering both candidate products. The API key needs transaction-write, price-read and discount-read permissions. Configure a Paddle notification destination pointing to `/api/billing/webhooks/paddle` and subscribe to `transaction.paid`, `transaction.completed`, `transaction.payment_failed`, `transaction.past_due`, `transaction.canceled`, `subscription.created`, `subscription.updated`, `subscription.past_due` and `subscription.canceled`. Copy that destination's secret to `PADDLE_WEBHOOK_SECRET`.

## Security and accounting requirements

- Hosted checkout/tokenization only; never store PAN or CVV.
- Verify webhook signatures against the unmodified raw request body.
- Enforce event idempotency and replay protection. Paddle does not accept client-supplied API idempotency keys; local payment/event records are idempotent, and ambiguous transaction-create timeouts must be reconciled before retrying.
- Validate merchant account, product reference, customer/workspace, amount and currency.
- Keep an immutable payment and credit ledger.
- Reconcile provider settlements, fees, refunds and chargebacks.
- Do not trust client-supplied price, currency, plan, workspace or credit quantity.
- Use least-privilege admin access and redact provider secrets from logs.
- Maintain cancellation, refund, dispute and failed-renewal workflows.
- Confirm Tunisian company, tax, foreign-exchange and export-of-services obligations with qualified professionals and the settlement bank.

## Implementation sequence

1. Provider-independent readiness and adapter contracts.
2. Workspace-owned recruiter subscriptions and credit ledger.
3. Paddle integration after merchant onboarding and current API verification.
4. Tunisian gateways individually, after merchant approval and documentation review.
5. Billing portal, invoices, refunds, cancellation and reconciliation.
6. Production enablement only after sandbox and controlled live verification.
