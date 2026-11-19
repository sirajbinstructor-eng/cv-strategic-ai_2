import { pool } from "@/lib/db";

let bootstrapPromise: Promise<void> | undefined;

async function bootstrap(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "user" (
      id text PRIMARY KEY, name text NOT NULL, email text NOT NULL, email_verified boolean NOT NULL DEFAULT false,
      image text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      is_admin boolean NOT NULL DEFAULT false, is_unrestricted boolean NOT NULL DEFAULT false,
      consultant_entitled boolean NOT NULL DEFAULT false, analysis_trials_granted integer NOT NULL DEFAULT 3,
      analysis_trials_used integer NOT NULL DEFAULT 0, analysis_trials_reserved integer NOT NULL DEFAULT 0,
      analysis_trial_expires_at timestamptz NOT NULL DEFAULT '2026-12-31T22:59:59.000Z'
    )`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_unrestricted boolean NOT NULL DEFAULT false`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS consultant_entitled boolean NOT NULL DEFAULT false`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS analysis_trials_granted integer NOT NULL DEFAULT 3`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS analysis_trials_used integer NOT NULL DEFAULT 0`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS analysis_trials_reserved integer NOT NULL DEFAULT 0`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS analysis_trial_expires_at timestamptz NOT NULL DEFAULT '2026-12-31T22:59:59.000Z'`,
    `CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON "user"(email)`,
    `CREATE TABLE IF NOT EXISTS session (id text PRIMARY KEY, expires_at timestamptz NOT NULL, token text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), ip_address text, user_agent text, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE)`,
    `CREATE INDEX IF NOT EXISTS session_user_idx ON session(user_id)`,
    `CREATE TABLE IF NOT EXISTS account (id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, access_token text, refresh_token text, id_token text, access_token_expires_at timestamptz, refresh_token_expires_at timestamptz, scope text, password text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE INDEX IF NOT EXISTS account_user_idx ON account(user_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS account_provider_account_unique ON account(provider_id,account_id)`,
    `CREATE TABLE IF NOT EXISTS verification (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`,
    `CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier)`,
    `CREATE TABLE IF NOT EXISTS analysis_usage (id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, status text NOT NULL CHECK(status IN ('reserved','consumed','released')), mode text NOT NULL DEFAULT 'automatic', created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, failure_code text)`,
    `CREATE INDEX IF NOT EXISTS analysis_usage_user_created_idx ON analysis_usage(user_id,created_at)`,
    `CREATE INDEX IF NOT EXISTS analysis_usage_status_idx ON analysis_usage(status)`,
    `CREATE TABLE IF NOT EXISTS analysis_records (id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, mode text NOT NULL DEFAULT 'automatic', target_title text, match_score integer CHECK(match_score IS NULL OR (match_score>=0 AND match_score<=100)), result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE INDEX IF NOT EXISTS analysis_records_user_created_idx ON analysis_records(user_id,created_at)`,
    `CREATE TABLE IF NOT EXISTS discount_applications (
      id text PRIMARY KEY, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      category text NOT NULL CHECK(category IN ('student','recent_graduate','early_career')),
      nationality text NOT NULL CHECK(nationality IN ('tunisian','non_tunisian')),
      nationality_evidence_type text, student_evidence_type text, graduation_date timestamptz,
      no_work_since_graduation boolean, professional_experience_months integer,
      discount_percent integer NOT NULL CHECK(discount_percent IN (10,20,40)),
      status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revoked','expired')),
      review_notes text, reviewed_by text REFERENCES "user"(id) ON DELETE SET NULL, reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK((category IN ('student','recent_graduate') AND discount_percent IN (20,40)) OR (category='early_career' AND discount_percent=10))
    )`,
    `CREATE INDEX IF NOT EXISTS discount_applications_user_status_idx ON discount_applications(user_id,status)`,
    `CREATE INDEX IF NOT EXISTS discount_applications_status_created_idx ON discount_applications(status,created_at)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS discount_one_active_application_per_user ON discount_applications(user_id) WHERE status IN ('pending','approved')`
  ];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of statements) await client.query(statement);
    await client.query("COMMIT");
    console.info("[database] Authentication, analysis and discount schemas verified.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[database] Schema bootstrap failed:", error);
    throw error;
  } finally { client.release(); }
}

export function ensureAuthSchema(): Promise<void> {
  if (!bootstrapPromise) bootstrapPromise = bootstrap().catch((error) => { bootstrapPromise = undefined; throw error; });
  return bootstrapPromise;
}
