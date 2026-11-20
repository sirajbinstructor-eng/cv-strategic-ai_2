# Tunisian payment integrations — public API research and implementation gates

Research reviewed: 20 November 2026.

Public marketing claims are not treated as merchant approval, a signed contract, or proof that CV Strategist AI can receive payouts in its actual legal form. All local-provider flags remain disabled. No Render configuration is changed by this research.

## Executive decision

1. **Direct Flouci is the first Tunisian integration priority for one-time TND payments.** Its public contract documents hosted payment creation, HMAC-SHA256 signed webhooks and server-side payment verification. Its complete automatic recurring lifecycle is not publicly documented, so this contract must not be used for automatic monthly/annual subscription renewals.
2. **Direct ClicToPay / SMT is the next priority**, subject to acquiring-bank merchant onboarding, the official technical pack and SMT certification.
3. **Direct La Poste MPGS is the following priority.** D17 is treated as a distinct payment channel and must not be assumed to expose a public web checkout API; La Poste must confirm merchant eligibility and provide the official kit.
4. **iPay by Audasoft is an optional aggregator fallback, not the default route.** It may add a legitimate aggregator fee on top of underlying gateway charges. The authenticated merchant documentation supplied by the account owner now confirms the one-shot request/response, customer/plan/subscription and invoice endpoints, and webhook payload. However, it does not document webhook authentication/signatures or a trusted transaction-status lookup, and transaction.completed can include manually declared transfers/mandates. No automatic entitlement grant is allowed until these trust gaps are resolved.
5. **Konnect is a later one-time-payment candidate.** Public docs describe initiation, payment_ref webhook lookup, server-side payment details and sandbox. Automatic subscriptions remain blocked until the recurring lifecycle is documented.
6. **Paymee is a later alternative.** Its public API guide is older; current merchant availability, security, refunds and recurring capabilities must be reconfirmed.

## Provider capability matrix

| Provider | Publicly documented | Recurring evidence | Safe status |
|---|---|---|---|
| Flouci (direct) | Hosted one-time payment, HMAC-SHA256 v2 webhook, verify-payment, test app | Public recurring lifecycle incomplete; payment binding partner-only and CVC per charge | First implementation priority for one-time payments; subscriptions blocked |
| ClicToPay / SMT (direct) | Bank-acquired hosted SPS redirect; exact merchant contract private | No public recurring API contract reviewed | Second direct priority; await bank/SMT merchant kit and certification |
| La Poste MPGS / D17 (direct) | Official e-commerce kit and D17 merchant channels; exact API contract private | No public recurring API contract reviewed | Second direct priority; await official La Poste merchant kit; verify D17 web checkout availability |
| iPay (Audasoft aggregator) | JWT + X-Org-Id, create-oneshot request/response, invoices and webhook payload documented in authenticated merchant pack | Plan/subscription endpoints exist; automatic debit and renewal semantics still need end-to-end confirmation | Optional fallback only; webhook authenticity/status verification unresolved |
| Konnect | Initiation, API key, payment details lookup, GET webhook reference, sandbox | Recurring profile mentioned, but no full recurring API lifecycle in reviewed endpoints | One-time only after approval |
| Paymee | Create payment, hosted gateway iframe, webhook checksum | No public recurring contract reviewed | Secondary one-time candidate; re-confirm current support |
| Paddle | Existing app integration | Recurring SaaS subscription support | Existing international provider; separate merchant eligibility gates |

## iPay by Audasoft — optional aggregator fallback

Official sources:
- https://www.ipay.tn/
- https://www.ipay.tn/developpeurs
- https://www.ipay.tn/produits/paiement-oneshot
- https://www.ipay.tn/produits/paiement-recurrent
- https://www.ipay.tn/produits/webhooks-integrations
- https://dashboard.ipay.tn/

### Confirmed by the authenticated merchant documentation supplied by the account owner

- API base URL: https://api.ipay.tn.
- Authentication: Authorization: Bearer <JWT> and X-Org-Id: <organisation UUID>. The JWT is generated in the merchant admin interface and is documented as valid for one year. Actual Org ID and JWT are secrets/configuration and must never be committed or exposed to the browser.
- Customer endpoints: POST /api/admin/customers and PUT /api/admin/customers/:id.
- Plan endpoints: POST /api/admin/plans, PUT /api/integration/plans/update and POST /api/admin/plans/:id/archive.
- Subscription endpoint: POST /api/admin/subscriptions.
- One-shot payment endpoint: POST /api/admin/transactions/create-oneshot.
- One-shot required body: product_code, amount, currency, customer_name and customer_external_id; invoice_reference is optional.
- One-shot response: id, payment_url, amount, currency and invoice_reference.
- Invoice endpoints: GET /api/admin/invoices, GET /api/admin/invoices/:id and GET /api/admin/invoices/:id/pdf.
- Webhook events: transaction.created, transaction.completed, transaction.expired and transaction.failed. Payload includes type, timestamp and data fields id, status, product_id, customer_id, month, amount, currency and invoice_reference.
- Webhook health: GET /api/admin/webhooks/health, optionally with probe=true.

### iPay production blockers

- The supplied documentation does **not** describe webhook signature/authentication headers or a cryptographic callback verification method.
- It does **not** document a trusted server-side transaction status/detail endpoint. The invoice endpoints are not a substitute for a transaction verification endpoint unless iPay confirms their semantics and lookup guarantees.
- It explicitly says iPay does **not retry webhook delivery** after an error. Our endpoint would therefore need durable event intake and queueing before returning 200; delivery recovery cannot depend on provider retries.
- transaction.completed means payment validated but may represent an electronic payment, a manually declared bank transfer/postal mandate, or a dashboard status update. It is not sufficient proof of electronically settled funds.
- Obtain written answers on callback authentication, transaction verification, manual-vs-electronic settlement distinction, replay protection, refunds/chargebacks, sandbox and production activation.
- Until those questions are resolved, keep iPay disabled and do not grant subscriptions or credits from its webhook alone.

### Cost and routing policy

iPay is not the preferred route when a direct integration offers the same payment method at a lower total merchant cost. Compare the actual written merchant fees, gateway fees, settlement charges and payout terms. Show iPay only as a separately selected optional fallback; never silently reroute a failed direct payment through it.

## Flouci — first direct one-time integration priority

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

## ClicToPay / SMT — direct integration priority

STB's official merchant page confirms merchant eligibility for Tunisia-established STB merchants, redirect to the SPS payment server, and a payment response to the customer and merchant server. Merchant affiliation agreement and SMT tests are required before production.

Official merchant information: https://www.stb.com.tn/fr/entreprises/la-banque-au-quotidien/clic-to-pay/

No public authoritative API schema, signature specification, status-query contract, test host or production credentials were found. Obtain these from the acquiring bank/SMT pack. Do not implement from unofficial old plugins or guessed register.do/status endpoints.

## La Poste Tunisienne / MPGS / D17 — direct integration priority

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

## iPay merchant documentation supplied by the account owner

The authenticated merchant documentation supplied on 20 November 2026 confirms:
- Base URL: https://api.ipay.tn.
- Authentication headers: Authorization: Bearer <JWT> and X-Org-Id: <organisation UUID>. The JWT is generated in the admin interface and is documented as valid for one year. Do not commit the organisation UUID or token.
- Customer endpoints: POST /api/admin/customers and PUT /api/admin/customers/:id.
- Plan endpoints: POST /api/admin/plans, PUT /api/integration/plans/update and POST /api/admin/plans/:id/archive.
- Subscription endpoint: POST /api/admin/subscriptions.
- One-shot endpoint: POST /api/admin/transactions/create-oneshot. Required body fields: product_code, amount, currency, customer_name and customer_external_id; invoice_reference is optional. Response fields include id, payment_url, amount, currency and invoice_reference.
- Invoice endpoints: GET /api/admin/invoices, GET /api/admin/invoices/:id and GET /api/admin/invoices/:id/pdf.
- Webhook events: transaction.created, transaction.completed, transaction.expired and transaction.failed. The documented payload includes event type, timestamp and transaction data (id, status, product_id, customer_id, month, amount, currency and invoice_reference).
- Webhook health endpoint: GET /api/admin/webhooks/health, optionally ?probe=true.

### iPay production blockers from the supplied merchant documentation
- It does not describe webhook signature/authentication headers or a cryptographic verification mechanism.
- It does not document a trusted server-side transaction status/detail endpoint.
- It says iPay does not retry webhook delivery after an error.
- transaction.completed may represent an electronic payment, a manually declared bank transfer/postal mandate, or a dashboard status update. This is not sufficient proof of settled funds.
- Therefore, do not grant subscription/credit entitlements from transaction.completed alone. Obtain written answers from iPay on callback authentication, status verification, manual payment distinction, retry/replay protection, refunds and sandbox.
- The supplied document shows the merchant Org ID in its example; keep actual Org ID and JWT only in server-side deployment secrets/configuration, never in Git, frontend bundles, logs or chat.

## Next implementation sequence

1. Implement and test direct Flouci hosted one-time checkout, signed webhook verification and server-side status confirmation for a product that has a defined one-time purchase model. Keep automatic recurring candidate subscriptions blocked until Flouci supplies its recurring API contract.
2. Obtain the official ClicToPay/SMT merchant kit and bank certification; implement the direct hosted flow and status verification from those exact materials.
3. Obtain the official La Poste MPGS merchant kit; implement its direct hosted flow. Treat D17 as a distinct channel only if La Poste confirms a supported web merchant API and provides its contract.
4. Keep iPay as an optional, explicitly labelled aggregator fallback. Before implementing it, obtain cryptographic callback authentication or a trusted server-side verification route and confirm how manual transfer/mandate declarations are distinguished from settled electronic payments.
5. Prepare Konnect one-time integration for future credit packs; keep subscriptions blocked pending recurring API details.
6. Revisit Paymee after written confirmation of current service status and updated security documentation.

Do not use docs.i-pay.io as iPay by Audasoft documentation; it is a different service with a different payment/settlement model.

## Regulatory note
Confirm the actual merchant's legal eligibility, foreign-currency collection, payout route and cross-border data obligations with the provider, settlement bank and qualified Tunisian advisers. BCT Circular 2026-10 is published in JORT: https://www.jort.tn/view/journal-officiel/fr/2026/102/circulaire-2026-10/
