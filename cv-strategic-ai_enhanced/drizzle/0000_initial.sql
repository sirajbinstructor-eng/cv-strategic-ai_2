CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
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
  "analysis_trial_expires_at" timestamptz NOT NULL DEFAULT '2026-12-31T22:59:59.000Z',
  CONSTRAINT "user_trial_counters_nonnegative" CHECK ("analysis_trials_granted" >= 0 AND "analysis_trials_used" >= 0 AND "analysis_trials_reserved" >= 0),
  CONSTRAINT "user_trial_reservation_cap" CHECK ("analysis_trials_used" + "analysis_trials_reserved" <= "analysis_trials_granted")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email");
CREATE INDEX IF NOT EXISTS "user_admin_idx" ON "user" ("is_admin");

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_user_idx" ON "session" ("user_id");

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
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
);
CREATE INDEX IF NOT EXISTS "account_user_idx" ON "account" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_unique" ON "account" ("provider_id", "account_id");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

CREATE TABLE IF NOT EXISTS "analysis_usage" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "status" text NOT NULL CHECK ("status" IN ('reserved', 'consumed', 'released')),
  "mode" text NOT NULL DEFAULT 'automatic',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "failure_code" text
);
CREATE INDEX IF NOT EXISTS "analysis_usage_user_created_idx" ON "analysis_usage" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "analysis_usage_status_idx" ON "analysis_usage" ("status");

CREATE TABLE IF NOT EXISTS "analysis_records" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "mode" text NOT NULL DEFAULT 'automatic',
  "target_title" text,
  "match_score" integer CHECK ("match_score" BETWEEN 0 AND 100),
  "result" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "analysis_records_user_created_idx" ON "analysis_records" ("user_id", "created_at");
