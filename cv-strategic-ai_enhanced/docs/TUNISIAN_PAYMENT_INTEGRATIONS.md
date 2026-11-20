# Tunisian payment integration plan

## Decision and order

1. **iPay aggregator first.** Its public materials advertise one API for local methods including ClicToPay and D17, with one-time payments, recurring plans and webhooks.
2. **Direct ClicToPay / SMT second.** This is an independent fallback acquired through the merchant's Tunisian bank and certified with SMT.
3. **Direct La Poste / e-Dinar / D17 third.** Proceed only if La Poste supplies a merchant kit and confirms D17 wallet checkout eligibility for this business.
4. Retain Flouci and other local gateways as later candidates.

iPay's D17 and ClicToPay are payment methods offered through the aggregator; they are not the same as direct La Poste or direct SMT integrations.

## Current implementation status

This PR adds provider catalogue entries, readiness gates, reserved environment-variable names, documentation and tests. It does **not** implement the iPay, ClicToPay or La Poste/D17 HTTP adapters and does not enable checkout.

- All three providers are disabled by default.
- Credentials and enablement flags alone cannot make them checkout-ready.
- Only Paddle currently has an implemented adapter.
- No credentials are added to source control or hosting settings.
- No payment can be taken through these new routes.

## iPay aggregator

Public materials advertise nine local payment methods, including ClicToPay and D17, recurring payments, REST API and webhooks. The public developer overview describes JWT bearer authentication and an X-Org-Id header, and lists admin endpoints for customers, plans, subscriptions and transactions.

The complete payment-creation schema, checkout redirect response, webhook authentication/signature contract, retry semantics, refunds and sandbox details are described as available inside the authenticated merchant dashboard. Obtain and review that documentation before writing the adapter. Do not guess API paths, request fields or webhook security.

Merchant questions:
- Confirm legal entity eligibility and required documents.
- Confirm payment methods available to this merchant, especially D17 and ClicToPay.
- Obtain sandbox credentials, full API specification and webhook signing/verification procedure.
- Confirm TND settlement account, fees, settlement schedule, refunds, disputes and reconciliation.
- Confirm recurring support, retries and cancellation for each underlying payment method.

## Direct ClicToPay / SMT

ClicToPay is acquired through a Tunisian bank. The bank supplies the merchant affiliation process and coordinates integration testing with SMT. Public bank material describes redirection to the SPS payment server and server-side transaction notification. A community WooCommerce integration documents register.do and getOrderStatusExtended.do, but this is not a substitute for the current official merchant API pack.

Obtain:
- Acquiring bank, merchant eligibility and settlement account requirements.
- Official API specification, test/live base URLs, API credentials, supported currencies and order-reference constraints.
- Notification/return URLs, 3-D Secure test scenarios, status polling contract and exact success/failure codes.
- Refund/void API, recurring/card-on-file availability (do not assume it exists), fees and reconciliation.
- SMT integration test matrix and written approval before production credentials.

Never grant access from a browser return. Verify payment server-to-server against the exact amount, currency and merchant order reference.

## Direct La Poste / e-Dinar / D17

D17 is a La Poste wallet/payment product; that does not establish a public standalone D17 merchant checkout API. La Poste's merchant e-commerce platform and its D17 wallet capabilities must be confirmed separately.

Obtain:
- Official merchant integration kit and confirmation that D17 wallet checkout is available for SaaS/digital services.
- Merchant eligibility, required postal/bank account, legal documents and sandbox environment.
- 3-D Secure, payment status confirmation, supported currencies, fees and settlement schedule.
- Refunds, recurring support and signed webhook or server-side status API details.

Do not implement a D17 deep link, QR flow or callback based on consumer-app behavior or third-party descriptions.

## Security and activation gates

Every adapter must implement server-side checkout using server-calculated amounts and references; strict merchant/order validation; authenticated webhooks or documented server-side polling; replay protection and idempotency; exact amount/currency matching; expiry, failure, refund and dispute handling; redacted logs; and no card data storage.

Activation requires written merchant approval, complete official API documentation, sandbox success/failure and duplicate/replay tests, refund tests, settlement verification, and a controlled live transaction after explicit approval.

## Reserved environment names

These are placeholders only. Do not add them to Render yet; exact names may change to match each provider's official integration pack.

- iPay: IPAY_ORG_ID, IPAY_API_TOKEN, IPAY_WEBHOOK_SECRET, BILLING_IPAY_MERCHANT_APPROVED, BILLING_PROVIDER_IPAY_ENABLED.
- Direct ClicToPay: CLICTOPAY_API_USERNAME, CLICTOPAY_API_PASSWORD, CLICTOPAY_API_BASE_URL, BILLING_CLICTOPAY_MERCHANT_APPROVED, BILLING_PROVIDER_CLICTOPAY_ENABLED.
- Direct La Poste/D17: LAPOSTE_MERCHANT_ID, LAPOSTE_MERCHANT_SECRET, LAPOSTE_API_BASE_URL, BILLING_LAPOSTE_MERCHANT_APPROVED, BILLING_PROVIDER_LAPOSTE_D17_ENABLED.

Never commit actual values or paste secrets into chat.

## Public references reviewed

- iPay overview: https://www.ipay.tn/a-propos
- iPay developer overview: https://www.ipay.tn/developpeurs
- iPay aggregator methods: https://www.ipay.tn/produits/agregateur-paiements
- STB ClicToPay merchant information: https://www.stb.com.tn/fr/entreprises/la-banque-au-quotidien/clic-to-pay/
- La Poste / e-Dinar and D17 background: https://fintechtunisia.com/fr/blog/la-poste-tunisienne-e-dinar-d17.html

Public marketing material is not proof of merchant acceptance, regulatory status, recurring support or production API readiness. Verify directly with the contracting provider and settlement bank.
