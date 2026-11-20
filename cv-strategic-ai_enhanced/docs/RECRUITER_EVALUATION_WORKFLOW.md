# Recruiter evaluation workflow

## Current implementation
- Company-owned recruiter workspace with job-description CRUD (archive instead of hard delete).
- Private candidate CV library accepts PDF and DOCX, up to 10 files per upload.
- Original files are not retained. Extracted CV text, candidate filenames and stored evaluation results are encrypted at rest using AES-256-GCM.
- Batch evaluation supports up to 10 CVs and 5 open job descriptions per CV (maximum 50 distinct CV/JD pairs).
- One credit represents one CV assessed against one job description.
- Existing CV extraction, Groq structured analysis, evidence validation and deterministic scoring are reused from the candidate workflow.
- Failed pair evaluations release their reserved credits; successful pairs consume one credit each.
- Results are stored per CV/JD pair and shown as evidence-based decision support, not an automated hiring decision.
- Candidate CV records expire after 90 days and can be deleted earlier by workspace members with write access.

## Required deployment configuration
Set `RECRUITER_CV_ENCRYPTION_KEY` to a cryptographically random 32-byte key, encoded as 64 hexadecimal characters or base64. Generate it with a secure password/key generator; do not reuse the Better Auth, Paddle, Groq, or any other application secret. Keep a secure offline backup. Losing this key makes stored CV text permanently unreadable. Rotate only with a planned decrypt/re-encrypt migration.

The recruiter upload API returns HTTP 503 until this key is configured. No plaintext CV content is stored in PostgreSQL. The encryption key is never returned by any API.

## Credits and subscription readiness
The recruiter workspace reads credits from its own workspace-level credit account and active recruiter subscription. Candidate quotas and candidate subscriptions are not reused or deducted.
- Multi-CV or multi-position batches require the premium batch-matching entitlement.
- An active subscription's included credits and purchased credit packs are separate buckets.
- Credits are reserved before AI processing, consumed only for successful evaluations, and returned for failed evaluations.
- Administrator/unrestricted accounts bypass recruiter credits and premium gates for testing.
- No default recruiter prices, credit allowances, or seat limits are invented. Non-admin workspaces cannot evaluate until credits and the required entitlement are granted by a verified recruiter billing event or an authorized administrative operation.

Recruiter checkout remains disabled until the recruiter plan catalogue, credit-pack prices, provider-specific product/price IDs, merchant onboarding, settlement, webhook verification and recurring-payment capabilities are approved. No payment provider is enabled by this change.

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
