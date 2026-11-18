import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Use your managed PostgreSQL connection; no local database is assumed.");
}

const globalForPg = globalThis as unknown as { pgPool?: Pool };
const pool = globalForPg.pgPool ?? new Pool({
  connectionString,
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // Require TLS with normal certificate validation when explicitly configured.
  ...(process.env.PGSSLMODE === "require" ? { ssl: true } : {})
});

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export const db = drizzle(pool, { schema });
export { pool };
