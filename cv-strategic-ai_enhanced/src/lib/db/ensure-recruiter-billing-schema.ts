import { pool } from "@/lib/db";

let recruiterSchemaPromise: Promise<void> | undefined;

/**
 * Workspace-owned recruiter billing schema.
 * This is additive: candidate billing tables and their existing user quotas
 * are intentionally left unchanged.
 */
async function bootstrapRecruiterBillingSchema(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS recruiter_workspaces (
      id text PRIMARY KEY,
      name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
      slug text NOT NULL UNIQUE CHECK(length(trim(slug)) BETWEEN 3 AND 80),
      owner_user_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','closed')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS recruiter_workspaces_owner_idx ON recruiter_workspaces(owner_user_id,status)`,
    `CREATE TABLE IF NOT EXISTS recruiter_workspace_members (
      workspace_id text NOT NULL REFERENCES recruiter_workspaces(id) ON DELETE CASCADE,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      role text NOT NULL CHECK(role IN ('owner','admin','recruiter','viewer')),
      status text NOT NULL DEFAULT 'active' CHECK(status IN ('invited','active','suspended','removed')),
      invited_by text REFERENCES "user"(id) ON DELETE SET NULL,
      joined_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(workspace_id,user_id)
    )`,
    `CREATE INDEX IF NOT EXISTS recruiter_workspace_members_user_idx ON recruiter_workspace_members(user_id,status)`,
    `CREATE TABLE IF NOT EXISTS recruiter_subscriptions (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES recruiter_workspaces(id) ON DELETE RESTRICT,
      provider text NOT NULL DEFAULT 'unselected',
      provider_customer_id text,
      provider_subscription_id text,
      plan_code text NOT NULL,
      billing_interval text NOT NULL CHECK(billing_interval IN ('monthly','annual')),
      currency text NOT NULL CHECK(currency IN ('USD','EUR','TND')),
      base_amount_minor integer NOT NULL CHECK(base_amount_minor>=0),
      amount_minor integer NOT NULL CHECK(amount_minor>=0),
      included_credits integer NOT NULL DEFAULT 0 CHECK(included_credits>=0),
      seat_limit integer NOT NULL DEFAULT 1 CHECK(seat_limit>=1),
      status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','past_due','canceled_at_period_end','expired','refunded','disputed')),
      current_period_start timestamptz,
      current_period_end timestamptz,
      cancel_at_period_end boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS recruiter_subscriptions_workspace_status_idx ON recruiter_subscriptions(workspace_id,status)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS recruiter_provider_subscription_unique ON recruiter_subscriptions(provider,provider_subscription_id) WHERE provider_subscription_id IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS recruiter_credit_accounts (
      workspace_id text PRIMARY KEY REFERENCES recruiter_workspaces(id) ON DELETE CASCADE,
      included_available integer NOT NULL DEFAULT 0 CHECK(included_available>=0),
      purchased_available integer NOT NULL DEFAULT 0 CHECK(purchased_available>=0),
      reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS recruiter_evaluation_batches (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES recruiter_workspaces(id) ON DELETE RESTRICT,
      created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      idempotency_key text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','canceled')),
      cv_count integer NOT NULL CHECK(cv_count BETWEEN 1 AND 10),
      job_description_count integer NOT NULL CHECK(job_description_count BETWEEN 1 AND 50),
      evaluation_count integer NOT NULL CHECK(evaluation_count BETWEEN 1 AND 50),
      credits_reserved integer NOT NULL CHECK(credits_reserved BETWEEN 1 AND 50),
      premium_batch_matching boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      started_at timestamptz,
      completed_at timestamptz,
      failure_code text,
      CHECK(credits_reserved=evaluation_count)
    )`,
    `CREATE INDEX IF NOT EXISTS recruiter_batches_workspace_created_idx ON recruiter_evaluation_batches(workspace_id,created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS recruiter_batch_pairs (
      id text PRIMARY KEY,
      batch_id text NOT NULL REFERENCES recruiter_evaluation_batches(id) ON DELETE CASCADE,
      cv_reference text NOT NULL,
      job_description_reference text NOT NULL,
      status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','canceled')),
      result jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      UNIQUE(batch_id,cv_reference,job_description_reference)
    )`,
    `CREATE INDEX IF NOT EXISTS recruiter_batch_pairs_batch_status_idx ON recruiter_batch_pairs(batch_id,status)`,
    `CREATE TABLE IF NOT EXISTS recruiter_credit_ledger (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES recruiter_workspaces(id) ON DELETE RESTRICT,
      batch_id text REFERENCES recruiter_evaluation_batches(id) ON DELETE SET NULL,
      credit_bucket text NOT NULL CHECK(credit_bucket IN ('included','purchased')),
      entry_type text NOT NULL CHECK(entry_type IN ('subscription_grant','credit_pack_purchase','evaluation_reserve','evaluation_consume','evaluation_release','refund_reversal','admin_adjustment')),
      amount integer NOT NULL CHECK(amount<>0),
      idempotency_key text NOT NULL UNIQUE,
      reference_id text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS recruiter_credit_ledger_workspace_created_idx ON recruiter_credit_ledger(workspace_id,created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS payment_transactions (
      id text PRIMARY KEY,
      product text NOT NULL CHECK(product IN ('candidate','recruiter')),
      user_id text REFERENCES "user"(id) ON DELETE RESTRICT,
      workspace_id text REFERENCES recruiter_workspaces(id) ON DELETE RESTRICT,
      provider text NOT NULL,
      provider_checkout_id text,
      provider_transaction_id text,
      reference_id text NOT NULL,
      purpose text NOT NULL CHECK(purpose IN ('subscription','one_time')),
      amount_minor integer NOT NULL CHECK(amount_minor>=0),
      currency text NOT NULL CHECK(currency IN ('USD','EUR','TND')),
      status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','refunded','disputed','expired')),
      idempotency_key text NOT NULL UNIQUE,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK((product='candidate' AND user_id IS NOT NULL AND workspace_id IS NULL) OR (product='recruiter' AND workspace_id IS NOT NULL AND user_id IS NULL))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_transaction_unique ON payment_transactions(provider,provider_transaction_id) WHERE provider_transaction_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS payment_transactions_reference_status_idx ON payment_transactions(reference_id,status)`
  ];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of statements) await client.query(statement);
    await client.query("COMMIT");
    console.info("[database] Recruiter workspace and billing schemas verified.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[database] Recruiter billing schema bootstrap failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

export function ensureRecruiterBillingSchema(): Promise<void> {
  if (!recruiterSchemaPromise) {
    recruiterSchemaPromise = bootstrapRecruiterBillingSchema().catch((error) => {
      recruiterSchemaPromise = undefined;
      throw error;
    });
  }
  return recruiterSchemaPromise;
}
