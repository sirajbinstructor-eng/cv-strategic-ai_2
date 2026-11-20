# CV Strategist AI — Next.js + TypeScript foundation

Version: `0.2.0`  
Architecture: Next.js App Router, React functional components, TypeScript, Better Auth, Drizzle ORM, PostgreSQL 18, Groq.

This is a migration from the previous Express + plain JavaScript application. The previous source is retained unchanged in `legacy-baseline/` as a reference. This package does not deploy itself and does not change the existing Render service or GitHub repository.

## What's included

- Next.js App Router with TypeScript and modular React functional components.
- Componentized landing page, registration/sign-in panel, dashboard, account settings, trial status, analysis workspace and results.
- Classic email/password registration and sign-in through Better Auth.
- Optional Google and Microsoft sign-in. The buttons become active when their OAuth credentials are configured.
- PostgreSQL-backed users, OAuth accounts, persistent sessions, trial usage and analysis records.
- PostgreSQL 18-compatible schema and initial Drizzle migration.
- Three successful Analysis-mode trials per eligible account, expiring at the end of 31 December 2026 in `Africa/Tunis`.
- Atomic trial reservations: concurrent requests cannot spend more trials than the account has. Failed AI requests release their reservation.
- Admin and unrestricted accounts bypass all candidate analysis and CV-generation quotas and can use both Analysis and Consulting modes. Privileged roles are never accepted from browser input.
- New users choose a Job Seeker or HR / Recruiter / Company account type after sign-in. Recruiter selection provisions a company-owned workspace.
- Analysis mode uses Groq only. The `openai` SDK is used only as a Groq-compatible HTTP client with `https://api.groq.com/openai/v1`.
- DOCX and text-PDF CV extraction (scanned PDF OCR is not included).
- Evidence-oriented analysis and ATS-friendly DOCX and PDF generation. PDF uses embedded Noto Sans fonts for selectable text and French accents.
- Evidence-status scoring normalization: fractional scores such as `0.68` are converted to `68`, category coverage is recalculated from evidence statuses, and the overall estimate is recomputed with fixed weights (mandatory 35%, responsibilities 25%, technical skills 20%, tools/methods 10%, seniority/leadership 10%).
- Raw extracted CV text is held in browser memory for the active session and is not stored in PostgreSQL. Structured analysis results and usage records are stored.
- Consulting is an application mode, separate from the commercial offers. It is available to administrators/unrestricted accounts and eligible Gold subscribers. Pro and Gold are the candidate offers; the internal billing identifier `consultant` remains stable for existing subscriptions.

## Important implementation boundaries

1. Payment checkout is not integrated yet. The `Upgrade now for more!` action opens an explanatory dialog until a payment provider is selected and approved.
2. Email verification and password-reset email delivery are not activated until a transactional email provider is selected. Do not treat classic email accounts as verified in this foundation release.
3. Google and Microsoft OAuth require credentials from their respective developer consoles. The buttons are disabled until configured.
4. Automatic linking of different sign-in providers by matching email is disabled to avoid unsafe account merging. A secure, authenticated provider-linking flow should be added after email verification is available.
5. DOCX and PDF output are included. Genuine legacy `.doc` conversion is not included because it requires a real document-conversion engine; a `.docx` file must never be renamed to `.doc`.
6. The application has not been connected to the live Render database, built with installed dependencies, or deployed. The TypeScript source passed syntax transpilation, but full type-check/build/tests could not be run because dependency installation timed out in this environment. Perform the setup and verification steps below before production use.

## Requirements

- Node.js `22.12` or newer (recommended: Node 22 LTS).
- npm 10 or newer.
- A managed PostgreSQL database. Your existing Render PostgreSQL 18 instance is suitable.
- A Groq API key.

No PostgreSQL server, pgAdmin, Redis or database software needs to be installed on your Windows computer. For development, you can work in the GitHub web editor and use Render's managed service / shell workflows. If you do run locally, Node/npm are required.

## Environment variables

Copy `.env.example` to `.env` for local development, or add these values in Render's Environment page:

| Variable | Required | Description |
|---|---:|---|
| `DATABASE_URL` | Yes | Internal Render PostgreSQL URL for the Render web service. Never share it in chat or commit it. |
| `BETTER_AUTH_SECRET` | Yes | Random secret, at least 32 characters. |
| `BETTER_AUTH_URL` | Yes | Public application origin, e.g. `https://your-domain.example`. |
| `GROQ_API_KEY` | Yes for AI | Groq API key. No OpenAI API key is used. |
| `GROQ_MODEL` | No | Defaults to `openai/gpt-oss-120b`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth web application credentials. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Optional | Microsoft Entra application credentials. |
| `MICROSOFT_TENANT_ID` | Optional | Defaults to `common` for personal and organizational Microsoft accounts. |
| `PGSSLMODE` | Optional | Set to `require` only if the selected connection requires TLS. Do not disable certificate checks globally. |

Generate a secret using a secure password manager or a cryptographically secure generator. Do not use the development fallback in production.

### OAuth callback URLs

Register these exact redirect URLs in the OAuth provider consoles, replacing the host with your production domain:

- Google: `https://YOUR_DOMAIN/api/auth/callback/google`
- Microsoft: `https://YOUR_DOMAIN/api/auth/callback/microsoft`

For local development, use `http://localhost:3000/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/microsoft`.

## Database setup

1. In Render, open the existing PostgreSQL 18 database.
2. Copy its **Internal Database URL** (not the password by itself).
3. In the Next.js web service's Environment page, set `DATABASE_URL` to that internal URL. Keep it secret.
4. Add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `GROQ_API_KEY`.
5. Install dependencies and apply the included migration:

   ```bash
   npm install
   npm run db:migrate
   ```

6. Build and start:

   ```bash
   npm run build
   npm start
   ```

The initial migration creates Better Auth's core tables plus account entitlements, trial usage, and analysis records. It does not drop or modify the legacy application's tables. Review the SQL before applying it to a production database. For later schema changes, add a new numbered SQL file under `drizzle/` and append its entry to `drizzle/meta/_journal.json`; keep `src/lib/db/schema.ts` and the SQL migration definitions in sync.

## Render deployment settings

For a Render Node web service:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Node version: `22.12.0` or newer (set `NODE_VERSION` if required by the service configuration).
- Set all environment variables before the first production build.
- Apply the database migration once before opening registration to users. Use Render Shell or a controlled deployment step; do not rely on the app to mutate the database schema at runtime.

Do not connect this new version to the current live service until the migration and smoke tests have passed and you explicitly approve switching production traffic.

## Promote your own account to admin / unrestricted

1. Register your owner account using the new app.
2. In Render Shell, run the following command, replacing the email with the account you control:

   ```bash
   CONFIRM_ADMIN_PROMOTION=YES npx tsx scripts/promote-admin.ts your-owner-email@example.com --unrestricted
   ```

This command updates an existing user only. It does not create accounts and does not expose a web endpoint for privilege escalation. Admin and unrestricted accounts bypass the three Analysis trials. Consulting mode remains a separate entitlement and is not activated in this foundation release.

Do not give the `--unrestricted` flag to ordinary testers. To grant/revoke the unrestricted trial exemption for an already registered test account, use Render Shell:

   ```bash
   CONFIRM_ACCESS_CHANGE=YES npx tsx scripts/set-unrestricted.ts tester@example.com grant
   CONFIRM_ACCESS_CHANGE=YES npx tsx scripts/set-unrestricted.ts tester@example.com revoke
   ```

## Trial policy

- New eligible account: 3 Analysis-mode trials.
- Only successfully completed analyses consume trials.
- Failed file extraction, validation or Groq requests do not consume a trial.
- A trial slot is reserved before the Groq call and finalized only after a valid analysis is persisted. Abandoned reservations older than 20 minutes are released on the next reservation attempt.
- The default launch allocation is 3 analyses, but administrators can change the number of analyses remaining for an individual account at any time.
- The admin user editor sets the user's **remaining** analyses directly; completed and in-progress analyses are preserved and the total grant is recalculated.
- The launch-offer banner is generated from the current server-side entitlement values: granted, completed, reserved and remaining analyses. It never assumes a fixed quota of 3.
- Examples: 10 remaining displays “Welcome! You have 10 free AI analyses.”; 1 remaining displays “Just 1 free analysis left!”; exhaustion displays the actual configured total (e.g. “You've used all 10 free analyses!”).
- The analysis API exhaustion response also uses the account's current configured quota rather than a hardcoded number.
- An open dashboard refreshes its account entitlements every 30 seconds and when the browser tab regains focus, so admin quota changes appear without signing out.
- After exhaustion, the analysis workspace is blurred/locked; dashboard and account settings remain accessible. A completed third analysis remains visible in the current browser session so the user can finish reviewing/generating that CV. After leaving or refreshing, the locked workspace is shown.
- Offer expiry is enforced by the server and database using the Tunisia local end-of-day boundary (2027-01-01 00:00:00 Africa/Tunis).
- Admin and unrestricted users bypass the trial cap and expiry.

## Architecture

```text
See `docs/COMPONENT_ARCHITECTURE.md` for the component tree, state ownership and hook guidelines.

src/
  app/                  Next.js routes and API handlers
  components/           Functional React UI components
  lib/
    ai/                 Groq client, analysis schema and validation
    db/                 PostgreSQL pool and Drizzle schema
    documents/          DOCX/PDF text extraction
    entitlements/       Atomic trial reservation and consumption
    auth.ts             Better Auth configuration
    auth-client.ts      Browser auth client
    server-session.ts   Server-side session guard
```

### State management decision

Redux is intentionally not included. The current needs are covered by:

- `useState` for component-local UI state.
- React Context only where a genuinely cross-cutting UI value appears.
- TanStack Query for server-state fetching, caching and invalidation.
- React Hook Form + Zod for form state and validation.
- PostgreSQL as the source of truth for accounts and entitlements.

Use `useEffect` only for external synchronization, `useMemo` for meaningful derived calculations, `useCallback` when stable callback identity is useful, and `useRef` for mutable non-render state. Do not add hooks mechanically.

## Verification checklist before production

- [ ] `npm install` completes without peer-dependency errors.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Apply migration to a staging PostgreSQL 18 database first.
- [ ] Verify email/password registration and sign-in.
- [ ] Verify Google OAuth and Microsoft OAuth separately after credentials are configured.
- [ ] Verify new account receives exactly 3 trials.
- [ ] Verify one successful analysis changes 3 → 2.
- [ ] Verify invalid file, invalid JD and Groq error do not consume a trial.
- [ ] Run concurrent requests to confirm trial reservations cannot exceed the cap.
- [ ] Verify the third successful analysis locks new analysis while preserving the current result until navigation/refresh.
- [ ] Verify admin and unrestricted accounts bypass the trial cap.
- [ ] Verify a normal user cannot alter roles or trial counters through API input.
- [ ] Verify DOCX opens in desktop Word 2016+ and text is selectable.
- [ ] Verify PDF opens correctly, includes embedded Noto Sans fonts, and has selectable text.
- [ ] Verify raw CV text does not appear in database tables or application logs.
- [ ] Configure email verification and payment integrations before charging customers or enabling paid subscriptions.

## Legacy source preservation

The original Express v3 source is copied into `legacy-baseline/` for reference. Do not delete it until the migrated application has passed functional regression tests. The live Render application remains untouched by this ZIP.
