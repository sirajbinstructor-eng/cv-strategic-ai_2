# Tunisian payment integrations — public API research and implementation gates

Research reviewed: 20 November 2026.

Public marketing claims are not treated as merchant approval, a signed contract, or proof that CV Strategist AI can receive payouts in its actual legal form. All local-provider flags remain disabled. No Render configuration is changed by this research.

## Executive decision

1. **iPay by Audasoft (ipay.tn) remains the first planned Tunisian integration**, as selected. Public pages now expose authentication, primary admin endpoints, the one-shot transaction endpoint and webhook event names. Detailed request/response schemas and the webhook trust contract remain in the authenticated merchant dashboard. Do not invent the transaction-creation body or grant access from an unauthenticated event.
2. **Flouci is the strongest publicly documented direct fallback.** Its public developer docs provide hosted payment creation, HMAC-signed webhooks, server-side verification, test credentials and a refund endpoint. However, unattended recurring-payment API details are not fully public. Its payment-binding feature is partner-restricted and a binding charge requires a CVC, so it is not an unattended renewal mechanism.
3. **Konnect is a documented one-time-payment candidate.** Public docs describe initiation, a payment_ref webhook followed by server-side payment-detail lookup, and sandbox endpoints. Do not use it for automatic subscriptions until the recurring profile/API contract is verified.
4. **Direct ClicToPay/SMT and La Poste MPGS/D17 remain merchant-kit integrations.** Public merchant pages establish high-level flow, not exact API schemas, callback signatures, certification or settlement arrangements.
5. **Paymee has an older public API guide** with sandbox creation and a checksum callback. Its current merchant availability, security guidance, refunds and recurring capabilities must be re-confirmed.

## Provider capability matrix

| Provider | Publicly documented | Recurring evidence | Safe status |
|---|---|---|---|
| iPay (Audasoft) | JWT + organisation header; one-shot endpoint; transaction callbacks | Public marketing describes plans/automatic debits; full contract dashboard-only | First priority; wait for merchant API pack |
| Flouci | Hosted payment, signed v2 webhooks, verify-payment, test app, refunds | Binding flow partner-only; CVC required for each binding charge. Separate recurring API referenced but not publicly specified | Direct one-time fallback; subscription adapter blocked |
| Konnect | Initiation, API key, payment details lookup, GET webhook reference, sandbox | Recurring profile mentioned, but no full recurring API lifecycle in reviewed endpoints | One-time only after approval |
| ClicToPay / SMT | Bank-acquired hosted SPS redirect and merchant-server response | No public recurring API contract reviewed | Wait for bank/SMT pack and certification |
| La Poste MPGS / D17 | E-commerce kit, MPGS card acceptance, D17/TPE channels | No public recurring API contract reviewed | Wait for official merchant kit |
| Paymee | Create payment, hosted gateway iframe, webhook checksum | No public recurring contract reviewed | Secondary one-time candidate; re-confirm current support |
| Paddle | Existing app integration | Recurring SaaS subscription support | Existing international provider; separate merchant eligibility gates |

## iPay by Audasoft — first integration

Official sources:
- https://www.ipay.tn/
- https://www.ipay.tn/developpeurs
- https://www.ipay.tn/produits/paiement-oneshot
- https://www.ipay.tn/produits/paiement-recurrent
- https://www.ipay.tn/produits/webhooks-integrations
- https://dashboard.ipay.tn/

### Publicly confirmed
- REST API authentication: Authorization: Bearer <JWT> and X-Org-Id: <organisation UUID>.
- Public developer page says the JWT is generated in the admin interface and is valid for one year.
- Listed endpoints: POST /api/admin/customers, POST /api/admin/plans, POST /api/admin/subscriptions, GET /api/admin/transactions and GET /api/admin/stats.
- One-shot endpoint: POST /api/admin/transactions/create-oneshot; public page says it returns a payment link.
- Webhook events: transaction.completed, transaction.created and transaction.failed.
- Public event fields: id, status, product_id, customer_id, month, amount, currency and invoice_reference.
- Webhooks are POST JSON, configurable by product/event; automatic retries and delivery history are advertised.
- Public recurring page advertises plans, monthly recurring payments, billing dates and renewals.

### Mandatory merchant-pack items before coding
The public developer page says full field definitions, curl examples and complete use cases are available after merchant-dashboard login. Obtain:
- Exact one-shot request body, response schema, API base URL and error model.
- Whether invoice_reference can be supplied and how it maps to our local pending payment intent.
- Whether Bearer JWT + X-Org-Id applies to every endpoint; token rotation/revocation rules.
- Webhook authentication/signature algorithm, header/token format, timestamp/replay rules.
- Server-side transaction status/detail endpoint and exact final states.
- How to distinguish an actual settled electronic payment from a manually declared transfer/postal mandate or dashboard operator action.
- Subscription create/renew/failure/cancel/pause/resume schemas and status lookup.
- Refund/void/chargeback support and payout timing, currencies, fees and bank destination.
- Sandbox, test accounts/cards, test webhook delivery and production activation.
- Merchant eligibility and whether recurring auto-debits cover this SaaS product category.

**Security:** transaction.completed is an event name, not proof of authenticity. Authenticate the callback, resolve the local intent, compare amount/currency/reference and use a server-side status lookup if available. If there is no cryptographically verifiable callback or trusted status query, do not grant paid access automatically.

## Flouci — publicly documented direct fallback

Official docs:
- https://docs.flouci.com/introduction
- https://docs.flouci.com/api-reference/generate-transaction
- https://docs.flouci.com/api-reference/payment-webhooks
- https://docs.flouci.com/api-reference/verify-transaction
- https://docs.flouci.com/api-reference/refund-payment
- https://docs.flouci.com/api-reference/advanced-payment-flow/payment-binding
- https://docs.flouci.com/essentials/testing
- https://docs.flouci.com/essentials/production

### Public one-time flow
- POST https://developers.flouci.com/api/v2/generate_payment.
- Authorization: Bearer <PUBLIC_KEY>:<PRIVATE_KEY>.
- Request amount is a string in millimes; includes developer_tracking_id, accept_card, success_link, fail_link, webhook and webhook_version: 2.
- Response contains result.payment_id and hosted result.link.
- Version 2 webhook is POST JSON with X-Flouci-Signature: t=<unix>,v1=<hex>.
- HMAC-SHA256 uses the private token over <timestamp>.<raw request body>; compare in constant time and reject stale timestamps.
- Events payment.succeeded/payment.failed include event_id, payment_id, developer_tracking_id, amount (millimes), currency and payment_method.
- After webhook, call GET https://developers.flouci.com/api/v2/verify_payment/{payment_id}; require top-level success and result.status === SUCCESS; compare amount and developer_tracking_id to the local intent.
- Test app and test cards are documented. Wallet payments do not have dedicated sandbox tests according to the docs.

### Recurring limitation
Payment binding is available only to selected partners on demand. Pay-with-binding requires a CVC on each charge and cannot be used for unattended recurring charges. Flouci refers to a separate Recurring Payments API, but the reviewed public API index does not expose its full contract. Do not infer that basic generate_payment or a dashboard subscription is sufficient for recurring API billing.

### Environment names
When approved, use server-only FLOUCI_PUBLIC_KEY and FLOUCI_PRIVATE_KEY. The private key is also the webhook HMAC key; do not invent a separate webhook secret unless Flouci supplies one. Never expose either key to the browser.

## Konnect — documented one-time candidate

Official docs:
- https://konnect.network/en/services/api-info/
- https://docs.konnect.network/docs/fr/api-integration/endpoints/initiate-payment
- https://docs.konnect.network/docs/fr/api-integration/endpoints/webhook
- https://docs.konnect.network/docs/fr/api-integration/endpoints/get-payment-details
- https://docs.konnect.network/docs/fr/overview/environments
- https://docs.konnect.network/docs/fr/overview/plan-your-integration

Publicly confirmed:
- POST /api/v2/payments/init-payment with x-api-key.
- Sandbox base: https://api.sandbox.konnect.network/api/v2/ ; production base: https://api.konnect.network/api/v2/.
- Request uses receiverWalletId, token, amount, type (immediate/partial), description, acceptedPaymentMethods and webhook.
- Amount uses millimes for TND and cents for EUR/USD.
- Response contains payUrl and paymentRef.
- Webhook is GET with payment_ref. Use it only as a lookup trigger, then call GET /payments/:paymentId.
- Trust payment.status === completed, compare currency and amount, and compare reachedAmount to expected amount. Partial payment must never activate a subscription.
- Public sandbox and test cards are documented.

The integration planner describes a hosted payment profile for recurring payments, but the reviewed API endpoint docs do not specify the full recurring lifecycle. Keep candidate monthly/annual subscription checkout blocked until subscription creation, renewal, failure, cancellation and status contracts are supplied. Konnect may be evaluated for future one-time recruiter credit packs after those products are commercially defined.

## ClicToPay / SMT

STB's official merchant page confirms merchant eligibility for Tunisia-established STB merchants, redirect to the SPS payment server, and a payment response to the customer and merchant server. Merchant affiliation agreement and SMT tests are required before production.

Official merchant information: https://www.stb.com.tn/fr/entreprises/la-banque-au-quotidien/clic-to-pay/

No public authoritative API schema, signature specification, status-query contract, test host or production credentials were found. Obtain these from the acquiring bank/SMT pack. Do not implement from unofficial old plugins or guessed register.do/status endpoints.

## La Poste Tunisienne / MPGS / D17

Official e-commerce pack information: https://www.poste.tn/index_service.php?code_menu=9&code_sous_menu=13

La Poste confirms an MPGS electronic payment kit, national and international postal/bank cards, D17 mobile-app and TPE payment channels, and merchant reporting/back-office. The international e-business offer advertises collection in foreign currency through MPGS, subject to actual merchant eligibility and contract.

The public page does not publish a standalone merchant API, callback/signature scheme, sandbox or recurring API. D17 public material describes merchant payments through app/QR and TPE; do not assume a public D17 web checkout API. Obtain the official merchant kit and confirm hosted/API flow, server-side status verification and recurring support.

## Paymee — secondary one-time candidate

Public guide: https://www.paymee.tn/paymee-integration-without-redirection/
- Sandbox POST https://sandbox.paymee.tn/api/v2/payments/create; production POST https://app.paymee.tn/api/v2/payments/create.
- Authorization: Token <api_key>.
- Request includes amount, note, first/last name, email, phone, webhook_url and optional return/cancel/order IDs.
- Response returns token and payment_url.
- Published guide describes an iframe and checksum MD5(token + payment_status + API Token).

The guide is dated 2022/2023. Re-confirm current service and merchant availability, checksum support, server-side status lookup, refunds, recurring and payout. Prefer hosted redirect if available. Do not collect phone/name only because an old example requires it without a product/legal need.

## Application invariants

1. Server owns plan, interval, currency, price, discounts, subscription ID and payment reference.
2. Create a local pending intent before provider API call; store provider reference, local subscription/credit reference, amount, currency and idempotency key.
3. Hosted checkout only; never store PAN, CVV, wallet passwords or bank credentials.
4. Browser success/cancel redirect is presentation only; it never grants entitlements.
5. Authenticate webhooks using the provider's documented mechanism; verify raw bytes where required; apply replay/timestamp checks and constant-time comparison where applicable.
6. Deduplicate by provider event/payment ID.
7. Match merchant, local reference, amount, currency and final state; query provider status where available.
8. Partial payment never activates a subscription.
9. Advance subscription periods only after a verified successful renewal payment.
10. Refunds, disputes, chargebacks, cancellations and failed renewals require explicit transitions and an auditable ledger.
11. Keep providers disabled until legal merchant approval, payout destination, API credentials, sandbox, reconciliation and production sign-off.

## Next implementation sequence

1. Obtain the iPay merchant dashboard API pack and sandbox credentials; implement iPay first after reviewing exact request, callback-authentication and status-query contracts.
2. Prepare Flouci one-time TND integration only if desired as a direct alternative; keep subscription renewal blocked pending its recurring API contract.
3. Prepare Konnect one-time integration for future credit packs; keep subscriptions blocked pending recurring API details.
4. Implement direct ClicToPay after bank/SMT pack and test merchant access.
5. Implement La Poste MPGS after its official merchant kit; treat D17 as a separate channel only if a supported merchant API is supplied.
6. Revisit Paymee after written confirmation of current service status and updated security documentation.

Do not use docs.i-pay.io as iPay by Audasoft documentation; it is a different service with a different payment/settlement model.

## Regulatory note
Confirm the actual merchant's legal eligibility, foreign-currency collection, payout route and cross-border data obligations with the provider, settlement bank and qualified Tunisian advisers. BCT Circular 2026-10 is published in JORT: https://www.jort.tn/view/journal-officiel/fr/2026/102/circulaire-2026-10/
