# Secure discount document verification — gated implementation

## Status
Uploads are DISABLED BY DEFAULT. This branch prepares the policy and fail-closed API surface only. It does not accept, parse, store, scan, or retain uploaded documents.

## Evidence required
- Tunisian nationality: Tunisian CIN, Tunisian passport, or Tunisian driving licence.
- Student: current student card.
- Recent graduate: latest diploma or graduation certificate containing the graduation date.
- A student/recent-graduate category takes priority over early-career eligibility. Discounts never stack.

## Required workflow before activation
1. Authenticate the applicant and create a pending verification case.
2. Issue a short-lived, single-purpose signed upload URL to a private object-storage bucket. Never use Render's ephemeral filesystem or a public bucket.
3. Allow only PDF, JPEG and PNG, maximum 10 MiB per file; verify file signatures/magic bytes, not only browser MIME type. Generate random object keys; strip metadata from image derivatives.
4. Scan files for malware and reject malformed, encrypted or oversized files. Keep originals private.
5. Provide admins a short-lived authenticated review link; enforce least privilege and log every view, download, decision and deletion.
6. Read the graduation date from the diploma/certificate and require manual confirmation. Do not use OCR output alone to approve eligibility.
7. Store only document type, secure object reference, review status, reviewer, timestamps and a minimal audit trail. Never store CIN/passport/driver-licence numbers in application metadata.
8. Delete originals promptly after review and enforce a short documented retention period for unresolved cases. Provide deletion on withdrawal/rejection, subject to lawful retention obligations.
9. Keep storage encryption at rest and in transit, rotate credentials, restrict bucket access, and test signed URL expiry and authorization boundaries.
10. Obtain Tunisian privacy/legal review before enabling cross-border storage or processing. Confirm controller/processor roles, INPDP formalities, transfer authorization, country/region, retention and applicant notices.

## Gate
DISCOUNT_DOCUMENT_UPLOADS_ENABLED must be explicitly set to true, private storage settings must exist, and STORAGE_ADAPTER_READY in the server gate must be changed only after the actual adapter and security tests have been reviewed. Setting environment variables alone is intentionally insufficient.

## API
- GET /api/discounts/documents/status: authenticated, returns the gate state and evidence policy.
- POST /api/discounts/documents: authenticated, currently returns HTTP 503 and never parses or persists the body.

## Non-goals
No ID verification provider, OCR provider, public URL, local disk storage, or automatic discount approval is enabled by this branch.
