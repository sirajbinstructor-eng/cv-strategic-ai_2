# HR / Company Billing — Approved Commercial Baseline and Implementation Plan

**Status:** Commercial subscription prices approved by product owner. Implementation planning only; no production billing behavior is enabled by this document.

**Repository baseline:** `main` at `fb99d345e87af7bda5177e029af9088647f1d253` (2026-11-20).

## 1. Approved company subscription catalogue

Company billing is a separate product from Job Seeker Pro / Gold. Company subscriptions belong to a company tenant/workspace, never to an individual employee account.

### Monthly subscriptions

| Plan | USD / month | EUR / month | TND / month | Included credits / month | Seats |
|---|---:|---:|---:|---:|---:|
| Free | $0 | €0 | 0 TND | 10 lifetime | 1 |
| Starter | $49 | €46 | 165 TND | 40 | 2 |
| Growth | $299 | €279 | 999 TND | 250 | 5 |
| Business | $899 | €839 | 2,999 TND | 800 | 15 |

### Annual subscriptions

Annual price is exactly ten times the monthly price in each currency (two months free). The full annual credit allowance is granted at the start of the annual term.

| Plan | USD / year | EUR / year | TND / year | Credits / year | Seats |
|---|---:|---:|---:|---:|---:|
| Starter | $490 | €460 | 1,650 TND | 480 | 2 |
| Growth | $2,990 | €2,790 | 9,990 TND | 3,000 | 5 |
| Business | $8,990 | €8,390 | 29,990 TND | 9,600 | 15 |

Prices are fixed per currency. Do not dynamically convert prices at checkout.

### Included capabilities

| Capability | Free | Starter | Growth | Business |
|---|---|---|---|---|
| Company tenants per subscription | 1 | 1 | 1 | 1 |
| Seats (including owner) | 1 | 2 | 5 | 15 |
| Single CV/job evaluation | Yes | Yes | Yes | Yes |
| Multi-CV or multi-job batch | No | Yes | Yes | Yes |
| Candidate/job ranking | Basic | Standard | Advanced | Advanced |
| Shared workspace | No | Basic | Yes | Yes |
| Advanced analytics | No | No | Yes | Yes |
| Priority processing | No | No | Yes | Yes |
| Priority support | No | No | No | Yes |

A seat is one individual account with active membership in the company workspace. The company owner consumes one seat. Pending invitations also reserve a seat so simultaneous invitations cannot exceed the plan limit.

One evaluation credit means one distinct CV evaluated against one job description. The existing two mutually exclusive workflows remain unchanged:
- One job description against 1–10 CVs.
- One CV against 1–5 job descriptions.
- No cross-product matrix (for example, 10 CVs × 5 jobs).

### Optional credit packs

The earlier proposal is retained as the working pack schedule. The subscription prices above are approved; pack checkout must not ship until these pack SKU prices are explicitly reconfirmed during the credit-pack implementation slice.

| Pack | Credits | USD | EUR | TND |
|---|---:|---:|---:|---:|
| Small | 50 | $19 | €18 | 65 TND |
| Medium | 200 | $59 | €55 | 199 TND |
| Large | 500 | $129 | €119 | 435 TND |

Pack policy:
- One-time purchase only; no automatic replenishment.
- Each pack lot expires 12 months after verified payment.
- Purchased credits survive subscription cancellation until their expiry.
- Included subscription credits are consumed before purchased credits.
- No credit or subscription entitlement is granted from a browser redirect.

## 2. Existing implementation discovered on main

The current main branch already contains:
- `recruiter_workspaces` and `recruiter_workspace_members` with owner/admin/recruiter/viewer roles.
- `recruiter_subscriptions` with plan, interval, currency, amounts, included credits, seat limit, period, status and premium batch flag.
- `recruiter_credit_accounts` with included, purchased and reserved aggregate balances.
- `recruiter_credit_ledger` with idempotency keys and evaluation grant/reserve/consume/release entries.
- `payment_transactions` supporting both candidate and recruiter product ownership.
- Atomic recruiter evaluation credit reservations and release/consume behavior.
- Provider readiness metadata, with Paddle the only implemented adapter; local direct providers remain unavailable until implemented and approved.

Important gaps to close:
1. No approved recruiter price catalogue or server-side quote/checkout/fulfilment flow.
2. No complete recruiter subscription lifecycle or company-facing billing portal.
3. Seat limits are stored but invitation/member seat enforcement must be added.
4. Team invitation workflow is not yet implemented.
5. Current workspace access helper silently chooses the first active workspace; this must be replaced before supporting members of multiple tenants.
6. Aggregate purchased-credit balance alone cannot correctly expire individual packs after 12 months. Add auditable credit lots and integrate them with the reservation engine.
7. The existing provider adapters do not yet provide a verified production checkout path for recruiter subscriptions or credit packs.

Do not replace or reuse candidate quota tables for recruiter billing.

## 3. Target architecture and business rules

### Tenant and seat model
- One company subscription owns exactly one company tenant/workspace.
- A workspace owner is included in the seat count.
- Active members and unexpired pending invitations consume seats.
- Invitation acceptance must re-check workspace status, invitation expiry, duplicate membership and available seats inside a transaction.
- Seat reductions on downgrade must not delete members automatically. Block the downgrade or require the owner to remove members until the target seat limit is satisfied.
- A person may be invited to more than one company. Workspace context must be explicit and membership-checked on every server request; never trust a client-supplied workspace ID without verifying membership.
- Admin/unrestricted testing bypass must not grant ordinary users additional seats or expose other tenants' data.

### Subscription and credit rules
- Free is a lifetime workspace entitlement: 10 credits, 1 seat, no premium batch capability. Grant once per workspace using an immutable idempotency key; re-provisioning or retries must not reset the allowance.
- Starter/Growth/Business monthly credits renew per paid monthly period.
- Annual credits are granted upfront (480 / 3,000 / 9,600) and expire at the end of the paid annual term.
- Included credits expire at the end of their subscription period and do not roll over.
- Purchased credits are tracked as separate lots, expire 12 months after payment, survive subscription cancellation and are consumed only after included credits.
- Reserve and release logic must preserve the source lot and its expiry; a failed evaluation must not revive already-expired credits.
- One evaluation consumes exactly one credit only after successful pair completion. Failed pairs release the exact reserved lot.
- Subscription changes take effect at the next renewal in the initial release. No prorated mid-cycle plan changes until a separate, explicit proration policy is approved.
- Cancellation takes effect at the end of the paid period. Access remains active through that period.
- Refunds, disputes and chargebacks create auditable ledger reversals and suspend/revoke the associated entitlement according to verified provider events and policy.

### Fixed prices and amount handling
- All plan and pack prices are server-owned catalogue values.
- Amounts are stored in integer minor units: USD/EUR exponent 2, TND exponent 3.
- Browser-submitted price, currency, plan, credit quantity, workspace ID and entitlement fields are never authoritative.
- Quote responses show currency, interval, amount, included credits, seats, term and any applicable tax/fee disclosure supplied by the provider. No tax amount is invented.

## 4. Delivery phases

### Phase A — Catalogue, policy and read-only pricing
- Add a separate recruiter catalogue module; do not alter `src/lib/billing/catalog.ts` candidate Pro/Gold prices or quotas.
- Add unit-tested fixed USD/EUR/TND monthly and annual prices, quotas, seat limits and feature flags.
- Add recruiter pricing page and workspace plan comparison with monthly/annual and currency selection.
- Display current plan, renewal/expiry date, seats used/available, included balance, purchased balance and credit expiry.
- Keep all checkout actions visibly unavailable until a matching provider is genuinely ready.
- Add admin read-only view of recruiter plans, subscriptions, credit balances and ledger.

**Acceptance:** candidate pricing and entitlements are unchanged; every recruiter price/credit/seat figure matches this document; no payment is created.

### Phase B — Tenant membership and seat enforcement
- Add secure workspace selection for users belonging to multiple tenants.
- Add owner/admin invitation, acceptance, revoke, removal and role-change flows.
- Count active users plus pending invitations atomically against `seat_limit`.
- Prevent owner removal, last-owner loss, invitations to suspended/closed workspaces and role escalation.
- Add audit events for membership and seat changes.
- Ensure every recruiter query and mutation is scoped to the selected, verified workspace.

**Acceptance:** one workspace cannot read or modify another workspace's CVs, jobs, evaluations, credits, invoices or members; seat limit cannot be exceeded under concurrent invites.

### Phase C — Credit accounting and lifecycle
- Add credit-lot storage for included monthly/annual grants, Free lifetime grants and purchased packs, including source, expiry, remaining balance and immutable idempotency reference.
- Migrate/bridge the existing aggregate balance safely; reconcile lot totals against `recruiter_credit_accounts`.
- Update batch reservation, completion and failure release to reserve from included lots first, then purchased lots, preserving expiry.
- Implement monthly renewal and annual upfront grant jobs/verified webhook fulfilment.
- Implement pack fulfilment, expiry processing and refund/dispute reversals.
- Add admin adjustments with reason, actor and idempotency audit trail.

**Acceptance:** concurrent evaluations cannot overspend; retries never double grant; expired lots cannot be consumed or revived; failed pairs release only their original lot.

### Phase D — Recruiter checkout and payment orchestration
- Add authenticated recruiter quote and checkout APIs using server-side catalogue lookups.
- Add payment product references for company subscription purchases and credit-pack orders.
- Use hosted provider checkout only; no card number/CVV storage.
- Fulfil subscriptions and packs only after a verified webhook or trusted server-side provider status query confirms merchant, reference, workspace, amount, currency and final payment state.
- Enforce provider event idempotency, replay tolerance, order matching, reconciliation and audit logs.
- Add payment status page, invoice/receipt history where provider data permits, cancellation and renewal UX.
- Keep candidate and recruiter product fulfilment paths isolated even if they share provider infrastructure.

**Provider constraints:**
- Flouci public contract currently supports hosted one-time payments and signed webhook plus server-side verification. It can support a prepaid monthly or annual recruiter term and one-time credit packs after merchant approval, but this is not automatic recurring billing. Clearly disclose manual renewal until a full recurring contract is verified.
- ClicToPay/SMT and La Poste/D17 remain blocked until official merchant integration packs, callback/status verification and certification are obtained.
- iPay remains optional fallback only after authenticated callback or trusted status lookup is provided.
- Paddle's current adapter is candidate-subscription-only and must not be assumed to support recruiter products until explicitly extended and tested.
- Do not enable any provider from environment variables alone. Keep provider flags false until merchant approval, sandbox tests, settlement and payout verification, and production sign-off.

**Acceptance:** a successful verified test transaction activates exactly one intended workspace entitlement; forged redirects, wrong amount/currency/workspace, duplicate webhooks, failed payments and replayed events grant nothing.

### Phase E — Production readiness and rollout
- Run migrations/bootstrap against a staging database first; no destructive schema changes or data resets.
- Run unit, integration, API and end-to-end tests for all plans, currencies, intervals, seats, lots, renewal, cancellation, refund, dispute and concurrent evaluation cases.
- Verify privacy notice, lawful basis, processor agreements, retention and cross-border data-transfer controls for recruiter CV processing.
- Verify merchant eligibility, fee schedule, settlement currency, bank payout route, refund/dispute process and accounting reconciliation.
- Enable one provider at a time after controlled merchant testing; monitor payment/ledger reconciliation before broader release.
- No Render secrets, environment variables, provider flags or production data are changed by the planning PR.

## 5. Proposed API surface

Final route names may follow existing conventions, but the contracts should cover:

| Method | Proposed endpoint | Purpose |
|---|---|---|
| GET | `/api/recruiter/billing/catalog` | Public-safe plan/price/feature catalogue |
| GET | `/api/recruiter/billing/quote` | Authenticated workspace quote |
| POST | `/api/recruiter/billing/checkout` | Start verified-provider checkout |
| GET | `/api/recruiter/billing/subscription` | Current plan, term, renewal and cancellation state |
| POST | `/api/recruiter/billing/cancel` | Schedule cancellation |
| GET | `/api/recruiter/billing/transactions` | Workspace payment history |
| POST | `/api/recruiter/billing/credit-packs/checkout` | Start one-time pack checkout |
| GET | `/api/recruiter/billing/credits` | Included/purchased lots, expiry and ledger summary |
| GET/POST | `/api/recruiter/members` | List/invite workspace members |
| PATCH/DELETE | `/api/recruiter/members/{id}` | Change role or remove member |
| POST | `/api/recruiter/invitations/{token}/accept` | Accept a workspace invitation |

Provider webhooks remain under the shared provider-specific webhook route, dispatching by the immutable payment product/reference and invoking separate candidate or recruiter fulfilment services.

## 6. Required tests

- Catalogue price/interval/currency and integer-minor-unit tests.
- Exact annual price = ten monthly payments; annual credit totals correct.
- Candidate Pro/Gold regression tests prove no price/quota change.
- Free lifetime grant idempotency and one-seat enforcement.
- Concurrent invitations cannot exceed seat limits.
- Multi-tenant selection and cross-tenant authorization tests.
- Included-first and purchased-lot allocation tests.
- Lot expiry, annual expiry, monthly renewal, cancellation and downgrade tests.
- Atomic reservation, failed-pair release, duplicate batch and concurrency tests.
- Duplicate webhook, invalid signature, stale timestamp, mismatched workspace, wrong amount/currency, partial payment, refund and dispute tests.
- End-to-end staging tests for monthly/annual subscription purchase and each pack size in every provider-supported currency.
- Regression of existing candidate checkout, candidate webhook and candidate entitlements.

Existing project validation commands are `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` from `cv-strategic-ai_enhanced`.

## 7. Explicit non-goals and release safeguards

- No modification to candidate Pro/Gold pricing, discounts, quotas or checkout behavior in the recruiter catalogue work.
- No automatic credit-pack replenishment.
- No automatic recurring billing claim for Flouci/ClicToPay/D17/iPay until their documented contracts and merchant accounts support it.
- No invented provider endpoints, secrets, settlement routes or merchant credentials.
- No direct card-data handling.
- No activation of provider flags, Render environment changes, deployment, database mutation or production payment testing as part of the planning phase.
- No merge without the product owner's explicit approval.

## 8. Implementation order

1. Phase A: recruiter catalogue, pricing page and admin visibility.
2. Phase B: tenant context, invitations and seat enforcement.
3. Phase C: credit lots and lifecycle.
4. Phase D: recruiter checkout/fulfilment, starting with the first merchant-approved provider whose contract supports the required transaction type.
5. Phase E: staging verification, merchant settlement checks and controlled production rollout.

This ordering allows the company pricing and entitlement experience to be built and tested without pretending that payment is live before merchant onboarding is complete.
