# CV Strategist AI — Authentication Repair v0.2.3

This package is based on the preserved v0.2.2 recovery project. It contains a focused authentication repair:

- Adds a non-destructive, idempotent PostgreSQL bootstrap for Better Auth tables. It creates missing auth tables and adds missing CV Strategist entitlement columns; it does not drop tables or delete data.
- Runs the schema check before Better Auth handles `/api/auth/*` requests.
- Logs the actual server-side database/auth exception and returns a clear 503 response if the auth database is unavailable.
- Makes the signup/sign-in UI catch rejected requests and show useful error messages instead of silently falling back to a generic message.
- Keeps email/password authentication enabled.
- Keeps Google and Microsoft buttons disabled until their own OAuth client ID and secret are configured.
- Corrects the default trial expiry timestamp to 2026-12-31 23:59:59 Africa/Tunis (2026-12-31 22:59:59 UTC).

## Deployment

The Render service must keep:

- Root Directory: `cv-strategic-ai_enhanced`
- Build Command: `npm install --include=dev && npm run build`
- Start Command: `npm start`

No local Node.js installation is required for deployment. Render builds the application.

## Required existing Render environment variables

Keep the existing `DATABASE_URL` and `GROQ_API_KEY`. Do not replace the PostgreSQL database or connection string.

Confirm these values exist and are correct:

- `BETTER_AUTH_SECRET`: a stable random secret of at least 32 characters. Do not rotate it casually; existing sessions depend on it.
- `BETTER_AUTH_URL`: exactly `https://cv-strategist-ai.onrender.com` (no `/api/auth` suffix).

The auth route now checks/creates the Better Auth tables on the first auth API request. This bootstrap is idempotent and uses only `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS`; it does not drop or truncate existing data. If a unique email index cannot be created because duplicate emails already exist, the server log will show that precise failure and signup will return HTTP 503 rather than a misleading generic error.

## Enable Google and Microsoft OAuth

The social buttons are intentionally disabled until credentials are supplied. Configure each provider separately in Render Environment:

Google:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- Authorized redirect URI: `https://cv-strategist-ai.onrender.com/api/auth/callback/google`

Microsoft Entra:
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- Optional `MICROSOFT_TENANT_ID` (use `common` for supported personal/work-school account types, subject to the app registration's supported account types)
- Redirect URI: `https://cv-strategist-ai.onrender.com/api/auth/callback/microsoft`

Do not put OAuth secrets in GitHub or in this ZIP. Add them only to Render's environment variables. After setting provider credentials, redeploy so the server-rendered sign-up page enables the relevant button.

## Files changed

- `src/lib/db/ensure-auth-schema.ts` (new)
- `src/app/api/auth/[...all]/route.ts`
- `src/components/auth/auth-panel.tsx`
- `src/lib/db/schema.ts` (trial expiry default correction)
- `drizzle/0000_initial.sql` (matching default correction)
- `.env.example` (documentation only)

The complete project tree is included; this ZIP is not a code fragment. The previous v0.2.2 archive remains the unchanged baseline.
