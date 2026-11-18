import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const action = process.argv[3];
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (process.env.CONFIRM_ACCESS_CHANGE !== "YES") {
    throw new Error("Set CONFIRM_ACCESS_CHANGE=YES to confirm this privileged operation.");
  }
  if (!email || !["grant", "revoke"].includes(action)) {
    throw new Error("Usage: CONFIRM_ACCESS_CHANGE=YES npx tsx scripts/set-unrestricted.ts user@example.com grant|revoke");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const result = await pool.query(
      `UPDATE "user" SET is_unrestricted = $2, updated_at = NOW() WHERE lower(email) = $1 RETURNING id, email, is_admin, is_unrestricted`,
      [email, action === "grant"]
    );
    if (!result.rowCount) throw new Error("No account found for that email. The user must register first.");
    process.stdout.write(`Updated account access: ${JSON.stringify(result.rows[0])}\n`);
  } finally {
    await pool.end();
  }
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
