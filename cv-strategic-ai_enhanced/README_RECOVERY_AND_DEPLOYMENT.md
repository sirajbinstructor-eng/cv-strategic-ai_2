# CV Strategist AI — consolidated recovery build 0.2.2

## What this package restores

This is a complete project tree based on the original Next.js foundation, merged with the later 0.2.1 route/UI additions and the fixes confirmed during the Render deployment attempts.

- One canonical Next.js App Router: `src/app/` (there is deliberately no root `app/`).
- Frontend homepage, dashboard, sign-in/sign-up routes and reusable components.
- Account, Better Auth, health, analysis and CV-generation API routes.
- PostgreSQL/Drizzle schema, migration, trial entitlements and admin utilities.
- Groq-only AI integration using native `fetch` (no OpenAI SDK dependency).
- Zod 4 `.prefault({})` fix for nested analysis schema defaults.
- Better Auth packages pinned to 1.7.25 and Drizzle ORM pinned to 0.45.4 to resolve the observed peer dependency conflict.
- Node >=22.12.0 and Render build command compatible with dev dependencies.

## Important before local startup

1. Copy `.env.example` to `.env`.
2. Fill in your existing PostgreSQL connection string and Groq API key locally. Never commit `.env`.
3. Set `BETTER_AUTH_SECRET` to a long random secret and `BETTER_AUTH_URL` to `http://localhost:3000` locally.
4. Run `npm install`, then `npm run dev`.

The production Render service must retain its existing environment variables and PostgreSQL database. Set `BETTER_AUTH_URL` to the exact public Render service URL and keep `BETTER_AUTH_SECRET` stable. Do not replace `DATABASE_URL`.

## Render settings

Build command: `npm install --include=dev && npm run build`

Start command: `npm start`

Node: `>=22.12.0` (the repository includes `.node-version`).

## Database safety

The package includes the existing Drizzle schema and initial migration. Do not run migrations against the existing production database until the schema has been compared with the live database and a database backup is confirmed. Do not change the Render database or connection variable during source recovery.

## PowerShell recovery

Use `Prepare-CVStrategist-Repo.ps1` from the extracted package. It backs up the current working tree (excluding `.git`, `.env`, `node_modules`, and `.next`), removes conflicting source files while preserving Git metadata and secrets, and copies this complete project into the repository. It does not commit or push automatically.
