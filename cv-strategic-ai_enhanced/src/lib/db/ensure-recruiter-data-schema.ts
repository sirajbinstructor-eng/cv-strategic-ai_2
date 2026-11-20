import { pool } from "@/lib/db";

let schemaPromise: Promise<void> | undefined;

async function bootstrap(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS recruiter_job_descriptions (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES recruiter_workspaces(id) ON DELETE CASCADE,
      title text NOT NULL CHECK(length(trim(title)) BETWEEN 2 AND 160),
      department text,
      location text,
      employment_type text,
      description text NOT NULL CHECK(length(trim(description)) BETWEEN 80 AND 30000),
      status text NOT NULL DEFAULT 'open' CHECK(status IN ('draft','open','closed','archived')),
      created_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS recruiter_jobs_workspace_status_idx ON recruiter_job_descriptions(workspace_id,status,created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS recruiter_candidates (
      id text PRIMARY KEY,
      workspace_id text NOT NULL REFERENCES recruiter_workspaces(id) ON DELETE CASCADE,
      original_filename text NOT NULL,
      content_type text NOT NULL CHECK(content_type IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
      encrypted_cv_text text NOT NULL,
      encryption_iv text NOT NULL,
      encryption_tag text NOT NULL,
      text_length integer NOT NULL CHECK(text_length>=80),
      uploaded_by text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      retention_expires_at timestamptz NOT NULL DEFAULT (NOW()+INTERVAL '90 days'),
      deleted_at timestamptz
    )`,
    `CREATE INDEX IF NOT EXISTS recruiter_candidates_workspace_created_idx ON recruiter_candidates(workspace_id,created_at DESC) WHERE deleted_at IS NULL`,
    `ALTER TABLE recruiter_evaluation_batches ADD COLUMN IF NOT EXISTS included_reserved integer NOT NULL DEFAULT 0`,
    `ALTER TABLE recruiter_evaluation_batches ADD COLUMN IF NOT EXISTS purchased_reserved integer NOT NULL DEFAULT 0`,
    `ALTER TABLE recruiter_evaluation_batches ADD COLUMN IF NOT EXISTS successful_evaluations integer NOT NULL DEFAULT 0`,
    `CREATE INDEX IF NOT EXISTS recruiter_pairs_completed_idx ON recruiter_batch_pairs(batch_id,status)`
  ];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of statements) await client.query(statement);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function ensureRecruiterDataSchema(): Promise<void> {
  if (!schemaPromise) schemaPromise = bootstrap().catch((error) => { schemaPromise = undefined; throw error; });
  return schemaPromise;
}
