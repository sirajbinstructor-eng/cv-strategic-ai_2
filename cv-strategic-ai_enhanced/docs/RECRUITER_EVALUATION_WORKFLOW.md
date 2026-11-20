# Recruiter evaluation workflow

## Supported evaluation workflows

The recruiter workspace supports exactly two alternative evaluation workflows. They are not combined into a cross-product.

### Workflow 1 — Evaluate candidates for one job
- HR selects exactly one open job description.
- HR selects between 1 and 10 candidate CVs.
- Every selected CV is evaluated against that same job description.
- Maximum: 10 evaluations and 10 credits.

### Workflow 2 — Find suitable jobs for one candidate
- HR selects exactly one candidate CV.
- HR selects between 1 and 5 different open job descriptions.
- That same CV is evaluated independently against each selected job.
- Maximum: 5 evaluations and 5 credits.

A request containing multiple CVs and multiple job descriptions is rejected. For example, 10 CVs × 5 job descriptions (50 evaluations) is not a supported workflow.

## Credit rules
- One credit represents one CV assessed against one job description.
- Workflow 1 costs 1–10 credits depending on the number of selected CVs.
- Workflow 2 costs 1–5 credits depending on the number of selected job descriptions.
- Failed pair evaluations release their reserved credits; successful evaluations consume one credit each.
- Multi-CV candidate comparisons (2–10 CVs against one job) or multi-position discovery (one CV against 2–5 jobs) require the premium batch-matching entitlement.
- The backend independently enforces these limits; bypassing the UI does not permit a multi-CV/multi-job matrix.

## Current implementation
- Company-owned recruiter workspace with job-description CRUD (archive instead of hard delete).
- Private candidate CV library accepts PDF and DOCX, up to 10 files per upload.
- Original files are not retained. Extracted CV text, candidate filenames and stored evaluation results are encrypted at rest using AES-256-GCM.
- Existing CV extraction, Groq structured analysis, evidence validation and deterministic scoring are reused from the candidate workflow.
- Results are stored per CV/job pair and shown as evidence-based decision support, not an automated hiring decision.
- Candidate CV records expire after 90 days and can be deleted earlier by workspace members with write access.

## Required deployment configuration
Set `RECRUITER_CV_ENCRYPTION_KEY` to a cryptographically random 32-byte key, encoded as 64 hexadecimal characters or base64. Generate it with a secure password/key generator; do not reuse the Better Auth, Paddle, Groq, or any other application secret. Keep a secure offline backup. Losing this key makes stored CV text permanently unreadable. Rotate only with a planned decrypt/re-encrypt migration.

The recruiter upload API returns HTTP 503 until this key is configured. No plaintext CV content is stored in PostgreSQL. The encryption key is never returned by any API.

## Credits and subscription readiness
The recruiter workspace reads credits from its own workspace-level credit account and active recruiter subscription. Candidate quotas and candidate subscriptions are not reused or deducted.
- An active subscription's included credits and purchased credit packs are separate buckets.
- Administrator/unrestricted accounts bypass recruiter credits and premium gates for testing.
- Recruiter prices, included-credit allowances and seat limits are managed separately from the candidate catalogue.
- Recruiter checkout remains disabled until recruiter pricing is approved and provider merchant onboarding, settlement, product IDs, webhook verification and recurring-payment capabilities are confirmed. No payment provider is enabled by this workflow change.

## Privacy and fairness
Only upload CVs the company is authorized to process. CV content, candidate filenames and evaluation results are encrypted in the database; the original upload bytes are discarded after extraction. A 90-day retention expiry is applied and deletion erases encrypted content. Before production, complete the required privacy notice, lawful-basis/consent process, processor agreements, retention policy and cross-border transfer review applicable to the organization's jurisdiction.

The evaluation prompt excludes protected characteristics and instructs the model not to infer them. Scores are explainable evidence-weighted estimates, not ATS pass/fail decisions or hiring probabilities. Human review is mandatory; do not use results for automatic rejection or selection.

## API
- `GET /api/recruiter/workspace`
- `GET, POST /api/recruiter/jobs`
- `PATCH, DELETE /api/recruiter/jobs/{id}`
- `GET, POST /api/recruiter/candidates`
- `DELETE /api/recruiter/candidates/{id}`
- `GET, POST /api/recruiter/batches`

All routes require authentication and active workspace membership. Writes require a non-viewer workspace role.
