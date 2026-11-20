import { pool } from "@/lib/db";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { ensureRecruiterDataSchema } from "@/lib/db/ensure-recruiter-data-schema";

export type RecruiterAccess = {
  userId: string; workspaceId: string; workspaceName: string; workspaceSlug: string;
  role: "owner" | "admin" | "recruiter" | "viewer"; isAdmin: boolean; unrestricted: boolean;
  canManage: boolean; premiumBatchMatchingEnabled: boolean; subscription: Record<string, unknown> | null;
  includedCredits: number; purchasedCredits: number; reservedCredits: number;
};

export async function requireRecruiterAccess(userId: string, write = false): Promise<RecruiterAccess> {
  await ensureAuthSchema();
  await ensureRecruiterDataSchema();
  const result = await pool.query(
    `SELECT w.id AS workspace_id,w.name AS workspace_name,w.slug AS workspace_slug,m.role,
      u.is_admin,u.is_unrestricted,
      (SELECT to_jsonb(s) FROM recruiter_subscriptions s
       WHERE s.workspace_id=w.id AND s.status IN ('active','canceled_at_period_end')
       AND s.current_period_start<=NOW() AND s.current_period_end>NOW()
       ORDER BY s.current_period_end DESC LIMIT 1) AS subscription,
      COALESCE(c.included_available,0)::int AS included_credits,
      COALESCE(c.purchased_available,0)::int AS purchased_credits,
      COALESCE(c.reserved,0)::int AS reserved_credits
     FROM recruiter_workspaces w
     JOIN recruiter_workspace_members m ON m.workspace_id=w.id
     JOIN "user" u ON u.id=m.user_id
     LEFT JOIN recruiter_credit_accounts c ON c.workspace_id=w.id
     WHERE m.user_id=$1 AND m.status='active' AND w.status='active'
     ORDER BY w.created_at LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error("An active recruiter workspace is required."), { status: 403 });
  const isAdmin = row.is_admin === true;
  const unrestricted = row.is_unrestricted === true;
  const role = row.role as RecruiterAccess["role"];
  const canManage = isAdmin || role === "owner" || role === "admin" || role === "recruiter";
  if (write && !canManage) throw Object.assign(new Error("Your workspace role is read-only."), { status: 403 });
  // Enforce the retention deadline when a workspace is accessed. Erase encrypted
  // CV text and redact stored evaluation results that reference expired CVs.
  const expired = await pool.query(
    `UPDATE recruiter_candidates SET deleted_at=NOW(),encrypted_cv_text='',encryption_iv='',encryption_tag=''
     WHERE workspace_id=$1 AND deleted_at IS NULL AND retention_expires_at<=NOW() RETURNING id`,
    [row.workspace_id]
  );
  if (expired.rowCount) {
    const expiredIds = expired.rows.map((item) => item.id);
    await pool.query(
      `UPDATE recruiter_batch_pairs SET status='canceled',result=NULL,completed_at=NOW()
       WHERE cv_reference=ANY($1::text[]) AND status='completed'`,
      [expiredIds]
    );
  }
  const subscription = row.subscription as Record<string, unknown> | null;
  return {
    userId, workspaceId: row.workspace_id, workspaceName: row.workspace_name, workspaceSlug: row.workspace_slug,
    role, isAdmin, unrestricted, canManage,
    premiumBatchMatchingEnabled: isAdmin || unrestricted || subscription?.premium_batch_matching_enabled === true,
    subscription,
    includedCredits: isAdmin || unrestricted ? 999999 : Number(row.included_credits),
    purchasedCredits: isAdmin || unrestricted ? 999999 : Number(row.purchased_credits),
    reservedCredits: Number(row.reserved_credits)
  };
}
