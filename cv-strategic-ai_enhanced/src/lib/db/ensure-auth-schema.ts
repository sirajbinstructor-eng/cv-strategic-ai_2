
import { pool } from "@/lib/db";

/**
 * Idempotent, non-destructive PostgreSQL schema bootstrap.
 *
 * Creates missing Better Auth and analysis tables.
 * Adds missing entitlement columns.
 * Never drops tables, deletes rows, or changes DATABASE_URL.
 */
let bootstrapPromise: Promise<void> | undefined;

async function bootstrap(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "user" (
      "id" text PRIMARY KEY,
      "name" text NOT NULL,
      "email" text NOT NULL,
      "email_verified" boolean NOT NULL DEFAULT false,
      "image" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "is_admin" boolean NOT NULL DEFAULT false,
      "is_unrestricted" boolean NOT NULL DEFAULT false,
      "consultant_entitled" boolean NOT NULL DEFAULT false,
      "analysis_trials_granted" integer NOT NULL DEFAULT 3,
      "analysis_trials_used" integer NOT NULL DEFAULT 0,
      "analysis_trials_reserved" integer NOT NULL DEFAULT 0,
      "analysis_trial_expires_at" timestamptz NOT NULL DEFAULT '2026-12-31T22:59:59.000Z'
    )`,

    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_unrestricted" boolean NOT NULL DEFAULT false`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "consultant_entitled" boolean NOT NULL DEFAULT false`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "analysis_trials_granted" integer NOT NULL DEFAULT 3`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "analysis_trials_used" integer NOT NULL DEFAULT 0`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "analysis_trials_reserved" integer NOT NULL DEFAULT 0`,
    `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "analysis_trial_expires_at" timestamptz NOT NULL DEFAULT '2026-12-31T22:59:59.000Z'`,

    `CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email")`,

    `CREATE TABLE IF NOT EXISTS "session" (
      "id" text PRIMARY KEY,
      "expires_at" timestamptz NOT NULL,
      "token" text NOT NULL UNIQUE,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      "ip_address" text,
      "user_agent" text,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
    )`,

    `CREATE INDEX IF NOT EXISTS "session_user_idx" ON "session" ("user_id")`,

    `CREATE TABLE IF NOT EXISTS "account" (
      "id" text PRIMARY KEY,
      "account_id" text NOT NULL,
      "provider_id" text NOT NULL,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "access_token" text,
      "refresh_token" text,
      "id_token" text,
      "access_token_expires_at" timestamptz,
      "refresh_token_expires_at" timestamptz,
      "scope" text,
      "password" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )`,

    `CREATE INDEX IF NOT EXISTS "account_user_idx" ON "account" ("user_id")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_unique" ON "account" ("provider_id", "account_id")`,

    `CREATE TABLE IF NOT EXISTS "verification" (
      "id" text PRIMARY KEY,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expires_at" timestamptz NOT NULL,
      "created_at" timestamptz DEFAULT now(),
      "updated_at" timestamptz DEFAULT now()
    )`,

    `CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier")`,

    // Analysis trial reservations and consumption history.
    `CREATE TABLE IF NOT EXISTS "analysis_usage" (
      "id" text PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "status" text NOT NULL,
      "mode" text NOT NULL DEFAULT 'automatic',
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "completed_at" timestamptz,
      "failure_code" text,
      CONSTRAINT "analysis_usage_status_check"
        CHECK ("status" IN ('reserved', 'consumed', 'released'))
    )`,

    `CREATE INDEX IF NOT EXISTS "analysis_usage_user_created_idx"
      ON "analysis_usage" ("user_id", "created_at")`,

    `CREATE INDEX IF NOT EXISTS "analysis_usage_status_idx"
      ON "analysis_usage" ("status")`,

    // Persisted analysis results.
    `CREATE TABLE IF NOT EXISTS "analysis_records" (
      "id" text PRIMARY KEY,
      "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
      "mode" text NOT NULL DEFAULT 'automatic',
      "target_title" text,
      "match_score" integer,
      "result" jsonb NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT "analysis_records_score_range"
        CHECK ("match_score" IS NULL OR ("match_score" >= 0 AND "match_score" <= 100))
    )`,

    `CREATE INDEX IF NOT EXISTS "analysis_records_user_created_idx"
      ON "analysis_records" ("user_id", "created_at")`
  ];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const statement of statements) {
      await client.query(statement);
    }

    await client.query("COMMIT");

    console.info("[database] Authentication and analysis schemas verified.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[database] Schema bootstrap failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

export function ensureAuthSchema(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap().catch((error) => {
      bootstrapPromise = undefined;
      throw error;
    });
  }

  return bootstrapPromise;
}
