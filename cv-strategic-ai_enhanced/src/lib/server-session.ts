import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";

/**
 * The Better Auth Drizzle adapter selects every configured user field when it
 * loads a session. Run the additive PostgreSQL schema bootstrap before that
 * query so older production databases receive newly introduced columns
 * (including account_type) before Better Auth attempts to select them.
 */
export async function getCurrentSession() {
  await ensureAuthSchema();
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    const error = new Error("Please sign in to continue.");
    Object.assign(error, { status: 401 });
    throw error;
  }
  return session.user;
}
