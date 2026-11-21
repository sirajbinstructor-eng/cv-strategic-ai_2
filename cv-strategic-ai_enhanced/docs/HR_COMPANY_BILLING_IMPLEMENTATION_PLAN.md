# HR / Company Billing — Approved Commercial Baseline and Implementation Plan

**Status:** Commercial subscription prices approved by product owner. Free-tier trial policy additionally approved on 2026-11-21. Implementation planning only; no production billing behavior is enabled by this document.

**Repository baseline:** `main` at `fb99d345e87af7bda5177e029af9088647f1d253` (2026-11-20).

## 1. Approved company subscription catalogue

Company billing is a separate product from Job Seeker Pro / Gold. Company subscriptions belong to a company tenant/workspace, never to an individual employee account.

### Monthly subscriptions

| Plan | USD / month | EUR / month | TND / month | Included credits / month | Seats |
|---|---:|---:|---:|---:|---:|
| Free | $0 | €0 | 0 TND | 3 Analysis trials + 1 Consulting trial (lifetime) | 1 |
| Starter | $49 | €46 | 165 TND | 40 | 2 |
| Growth | $299 | €279 | 999 TND | 250 | 5 |
| Business | $899 | €839 | 2,999 TND | 800 | 15 |

**Free-tier parity:** The Free offer for HR/company users must match the approved Job Seeker Free trial experience:
- 3 lifetime trials in **Analysis** mode.
- 1 lifetime trial in **Consulting** mode.
- These are mode-specific trials, not a pool of 4 interchangeable credits.
- No recurring monthly or annual credit grant on Free.
- The Consulting trial is a one-time entitlement, not an ongoing Consulting subscription.
- The Free workspace has one seat. The trial allowance is associated with the Free workspace owner's account/workspace entitlement and must not multiply when additional workspaces are created, invitations are resent, or users switch between HR and Job Seeker workspaces.
- Trial consumption must be tracked separately by mode and enforced server-side. A failed or cancelled run must not consume a trial; successful completion consumes exactly one trial for the selected mode.
- Once either allowance is exhausted, the relevant mode requires an eligible paid entitlement or admin/unrestricted access. Do not silently convert one mode's remaining trials into the other mode.

The same 3 Analysis + 1 Consulting Free trial policy is approved for Job Seeker accounts as well. Implementation must reconcile this with the existing Free Job Seeker policy (which previously included 3 Analysis trials and 1 CV generation, while Consulting mode was locked on Free). Do not count the old CV-generation allowance as a Consulting trial or silently remove existing user entitlements; define and test a safe migration/compatibility policy before changing existing accounts.

### Annual subscriptions

Annual price is exactly ten times the monthly price in each currency (two months free). The full annual credit allowance is granted at the start of the annual term.

| Plan | USD / year | EUR / year | TND / year | Credits / year | Seats |
|---|---:|---:|---:|---:|---:|
| Starter | $490 | €460 | 1,650 TND | 480 | 2 |
| Growth | $2,990 | €2,790 | 9,990 TND | 3,000 | 5 |
| Business | $8,990 | €8,390 | 29,990 TND | 9,600 | 15 |

Prices are fixed per currency. Do not dynamically convert prices at checkout.

### Approved startup and SME discounts

Discount eligibility is a company-level B2B verification workflow. Do not ask whether the HR user is a student, do not use student/founder status as a qualification route, and do not determine eligibility from an individual's personal profile. The applicant represents a registered legal business; verification is performed against that business's official registration and supporting company documents.

For this policy, a **startup is a very small registered enterprise that has been granted the official Startup Label** (or the equivalent official startup designation issued by the competent authority in its country). A submitted or pending application is not sufficient: the discount becomes available only after the label/designation has been formally granted and verified. There is no separate numerical employee threshold for startup status; the official label criteria determine qualification.

The following discounts apply to paid HR/company subscription plans (Starter, Growth and Business), for both monthly and annual billing, against the corresponding published list price:

| Eligible company category | Discount |
|---|---:|
| Tunisian startup | 20% |
| Startup outside Tunisia | 15% |
| PME / SME with fewer than 100 employees | 10% |

Discount rules:
- Discounts are **mutually exclusive**. A company may receive only one of these discounts on a subscription; percentages must never be added together or compounded.
- If a company qualifies for more than one category, apply only the single highest eligible discount: Tunisian startup 20%, other-country startup 15%, or SME 10%.
- A company must satisfy and verify the selected category before the discounted first purchase is issued. Verification is completed through secure company-document upload and administrative review; do not grant a discount based only on a user-selected checkbox or unverified claim.
- **Tunisian startup (20%) evidence:** official RNE extract / registre de commerce proving the registered legal entity, plus the officially issued Tunisian Startup Label. The label must identify or be reliably linked to the same legal entity. A receipt or proof of a submitted/pending application is not sufficient. Student status, personal founder status and incubator admission do not independently qualify.
- **Startup outside Tunisia (15%) evidence:** official company registration/incorporation evidence plus the officially granted startup label or equivalent formal designation issued by the competent authority in that country. A submitted/pending application is not sufficient. Evidence must identify or be reliably linked to the same legal entity and country. Personal student/founder status and personal declarations do not qualify.
- **PME/SME under 100 employees (10%) evidence:** official company registration evidence plus a recent official employee-headcount declaration or equivalent authority-issued record (for example, a CNSS/social-security declaration, payroll statement, tax or labour authority certificate, or official SME classification certificate) showing 0–99 employees. Exactly 100 employees does not qualify. For Tunisia, the company registration must identify the entity in the RNE / registre de commerce, and headcount must be supported by CNSS or another competent official administration. Documents should generally be dated within the preceding 90 days at application time; exceptions require manual approval.
- For startup eligibility, do not invent a separate numerical employee threshold: the official Startup Label or equivalent designation, once granted, determines whether the enterprise meets the startup criteria. An application in progress does not qualify.
- **Student founder:** student status alone does not qualify. The registered company must obtain the official Startup Label (or the equivalent granted designation) before the startup discount can be approved.
- **Individual founder:** personal founder status alone does not qualify. The company must provide official registration evidence and proof that the Startup Label/equivalent designation has been granted; an application receipt alone is insufficient.
- **Incubator-supported startup:** incubator admission or support may be accepted as supplementary context during the company's official label process, but it cannot replace the granted Startup Label/equivalent designation and does not independently qualify for the discount.
- **One-time, lifetime offer:** each legal company/entity may use one startup/SME discount once in its lifetime, on its first eligible paid subscription purchase only. The discount is not renewed, does not recur on monthly/annual renewals, and cannot be claimed again on a later plan change, new subscription, workspace, account or payment. Store a durable redemption record keyed to the verified legal entity identifier (and country); prevent duplicate redemption across accounts/workspaces.
- No periodic revalidation is required because the discount is not recurring. Evidence is reviewed once before the first discounted checkout. If the initial subscription purchase is cancelled or payment fails before successful fulfilment, no redemption is consumed; once the discounted purchase is successfully paid/fulfilled, the lifetime redemption is consumed.
- **Dedicated HR/company verification workflow:** during company onboarding or before the first discounted checkout, collect the legal company name, country, registration identifier, registered address and authorised representative details; request the evidence applicable to the claimed category (company registration, Startup Label application/label and/or employee headcount). Show verification status to the company owner and provide secure resubmission when evidence is incomplete or rejected. Keep this flow separate from Job Seeker onboarding and candidate profile data.
- **Manual review and privacy:** provide a secure admin review queue with approve/reject/request-more-information outcomes, reviewer identity, timestamp, reason and evidence references. Restrict access to uploaded proof to authorised reviewers, encrypt it at rest, avoid exposing document contents in logs, and apply a defined retention/deletion schedule after the decision and any legally required retention period. Do not retain more personal data than necessary.
- The discount applies to the subscription list price for the selected billing interval. Annual discounts are applied to the annual list price, not calculated by multiplying a discounted monthly amount in a way that changes the approved annual price basis.
- Show the list price, discount category, percentage, discount amount and final subscription price clearly in the quote and checkout summary.
- Do not stack these discounts with another promotional, referral, coupon or negotiated discount. If another promotion is introduced later, the pricing policy must explicitly define a single winning offer; no stacking by default.
- These discounts do not apply to Job Seeker Pro/Gold or the proposed one-time credit packs unless separately approved.
- Store the applied discount category, verified legal-entity identifier, verification evidence references, reviewer/decision audit, percentage, list amount, discount amount, final amount, currency, successful redemption timestamp and payment/subscription reference in an auditable lifetime redemption record. Enforce one redemption per legal entity across the entire platform.


### Included capabilities

| Capability | Free | Starter | Growth | Business |
|---|---|---|---|---|
| Company tenants per subscription | 1 | 1 | 1 | 1 |
| Seats (including owner) | 1 | 2 | 5 | 15 |
| Analysis mode | 3 lifetime trials | Included quota | Included quota | Included quota |
| Consulting mode | 1 lifetime trial | Included quota | Included quota | Included quota |
| Single CV/job evaluation | Yes, within trials | Yes | Yes | Yes |
| Multi-CV or multi-job batch | No | Yes | Yes | Yes |
| Candidate/job ranking | Basic | Standard | Advanced | Advanced |
| Shared workspace | No | Basic | Yes | Yes |
| Advanced analytics | No | No | Yes | Yes |
| Priority processing | No | No | Yes | Yes |
| Priority support | No | No | No | Yes |

A seat is one individual account with active membership in the company workspace. The company owner consumes one seat. Pending invitations also reserve a seat so simultaneous invitations cannot exceed the plan limit.

One paid evaluation credit means one distinct CV evaluated against one job description. The existing two mutually exclusive workflows remain unchanged:
- One job description against 1–10 CVs.
- One CV against 1–5 job descriptions.
- No cross-product matrix (for example, 10 CVs × 5 jobs).

Paid plan credits and Free mode-specific trials are separate entitlement types and must not be mixed into one fungible balance.

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
8. Mode-specific Free trial accounting and the safe migration from the previous Job Seeker Free policy need to be implemented and tested.

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

### Subscription, trial and credit rules
- Free mode-specific trials are lifetime allowances: 3 Analysis and 1 Consulting. Track each mode independently with immutable idempotency keys. Do not grant a generic 10-credit Free balance.
- Trial entitlements must not reset on workspace recreation, invitation resend, account type/workspace switching or repeated bootstrap. Apply the approved migration policy to existing Job Seeker accounts without granting duplicate trials or removing previously paid entitlements.
- A successful completed run consumes one trial of the selected mode. Failed/cancelled runs release reservations and do not consume trials.
- Starter/Growth/Business monthly credits renew per paid monthly period.
- Annual credits are granted upfront (480 / 3,000 / 9,600) and expire at the end of the paid annual term.
- Included paid credits expire at the end of their subscription period and do not roll over.
- Purchased credits are tracked as separate lots, expire 12 months after payment, survive subscription cancellation and are consumed only after included paid credits.
- Free mode-specific trials are not convertible to paid credits and paid credit packs do not replenish Free trials.
- Reserve and release logic must preserve the source lot/trial mode and expiry; a failed evaluation must not revive already-expired credits.
- One paid evaluation consumes exactly one credit only after successful pair completion. Failed pairs release the exact reserved lot.
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
- Display the Free plan's 3 Analysis + 1 Consulting lifetime trials separately, including remaining trials for each mode.
- Keep all checkout actions visibly unavailable until a matching provider is genuinely ready.
- Add admin read-only view of recruiter plans, subscriptions, credit balances and ledger.

**Acceptance:** candidate paid pricing and entitlements are unchanged; Free trial policy is consistent across Job Seeker and HR/company accounts after the approved safe migration; every recruiter paid price/credit/seat figure matches this document; no payment is created.

### Phase B — Tenant membership and seat enforcement
- Add secure workspace selection for users belonging to multiple tenants.
- Add owner/admin invitation, acceptance, revoke, removal and role-change flows.
- Count active users plus pending invitations atomically against `seat_limit`.
- Prevent owner removal, last-owner loss, invitations to suspended/closed workspaces and role escalation.
- Add audit events for membership and seat changes.
- Ensure every recruiter query and mutation is scoped to the selected, verified workspace.

**Acceptance:** one workspace cannot read or modify another workspace's CVs, jobs, evaluations, credits, invoices or members; seat limit cannot be exceeded under concurrent invites.

### Phase C — Credit accounting and lifecycle
- Add credit-lot storage for included monthly/annual grants and purchased packs, including source, expiry, remaining balance and immutable idempotency reference.
- Implement separate mode-specific Free trial counters/reservations for Analysis and Consulting, preserving their lifetime nature and existing-account migration rules.
- Migrate/bridge the existing aggregate paid balance safely; reconcile lot totals against `recruiter_credit_accounts`.
- Update batch reservation, completion and failure release to reserve from included paid lots first, then purchased lots, preserving expiry.
- Implement monthly renewal and annual upfront grant jobs/verified webhook fulfilment.
- Implement pack fulfilment, expiry processing and refund/dispute reversals.
- Add admin adjustments with reason, actor and idempotency audit trail.

**Acceptance:** concurrent evaluations cannot overspend; retries never double grant; expired lots cannot be consumed or revived; failed pairs release only their original lot; Free trials cannot be double-spent or reset.

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
- Run unit, integration, API and end-to-end tests for all plans, currencies, intervals, seats, lots, trials, renewal, cancellation, refund, dispute and concurrent evaluation cases.
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
- Free lifetime trial counts (3 Analysis + 1 Consulting), mode isolation, idempotent bootstrap and safe legacy-account migration.
- Free trial reservation/commit/release, failed run and concurrency tests.
- Free lifetime entitlement cannot reset through account type switching, workspace recreation, invitation resend or repeated bootstrap.
- Free one-seat enforcement and concurrent invitation tests.
- Multi-tenant selection and cross-tenant authorization tests.
- Included-first and purchased-lot allocation tests.
- Lot expiry, annual expiry, monthly renewal, cancellation and downgrade tests.
- Atomic reservation, failed-pair release, duplicate batch and concurrency tests.
- Duplicate webhook, invalid signature, stale timestamp, mismatched workspace, wrong amount/currency, partial payment, refund and dispute tests.
- End-to-end staging tests for monthly/annual subscription purchase and each pack size in every provider-supported currency.
- Regression of existing candidate checkout, candidate webhook and candidate entitlements.

Existing project validation commands are `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` from `cv-strategic-ai_enhanced`.

## 7. Explicit non-goals and release safeguards

- No modification to candidate Pro/Gold pricing or paid quotas in the recruiter catalogue.
- Implement the approved Free mode trial parity for both products only with an explicit compatibility migration; preserve existing paid entitlements and never duplicate/reset prior trial usage.
- No automatic credit-pack replenishment.
- No automatic recurring billing claim for Flouci/ClicToPay/D17/iPay until their documented contracts and merchant accounts support it.
- No invented provider endpoints, secrets, settlement routes or merchant credentials.
- No direct card-data handling.
- No activation of provider flags, Render environment changes, deployment, database mutation or production payment testing as part of the planning PR.
- No merge without the product owner's explicit approval.

## 8. Implementation order

1. Phase A: recruiter catalogue, pricing page and admin visibility, including the shared Free mode-specific trial policy.
2. Phase B: tenant context, invitations and seat enforcement.
3. Phase C: paid credit lots and Free trial lifecycle/migration.
4. Phase D: recruiter checkout/fulfilment, starting with the first merchant-approved provider whose contract supports the required transaction type.
5. Phase E: staging verification, merchant settlement checks and controlled production rollout.

This ordering allows the company pricing and entitlement experience to be built and tested without pretending that payment is live before merchant onboarding is complete.
