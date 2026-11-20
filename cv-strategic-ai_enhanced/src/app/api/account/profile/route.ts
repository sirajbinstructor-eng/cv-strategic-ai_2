import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentSession } from "@/lib/server-session";
import { pool } from "@/lib/db";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  await ensureAuthSchema();
  const body = await request.json().catch(() => ({}));
  const accountType = body.accountType;
  const workspaceName = typeof body.workspaceName === "string" ? body.workspaceName.trim() : "";
  if (accountType !== "job_seeker" && accountType !== "recruiter") return NextResponse.json({ error: "Choose Job Seeker or HR / Recruiter / Company." }, { status: 400 });
  if (accountType === "recruiter" && (workspaceName.length < 2 || workspaceName.length > 120)) return NextResponse.json({ error: "Enter a company or agency name (2–120 characters)." }, { status: 400 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query('SELECT account_type FROM "user" WHERE id=$1 FOR UPDATE', [session.user.id]);
    if (!current.rowCount) throw Object.assign(new Error("Account not found."), { status: 404 });
    if (current.rows[0].account_type && current.rows[0].account_type !== accountType) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Your account type has already been selected. Contact an administrator if it needs to be changed." }, { status: 409 });
    }
    await client.query('UPDATE "user" SET account_type=$2,updated_at=NOW() WHERE id=$1', [session.user.id, accountType]);
    let workspace = null;
    if (accountType === "recruiter") {
      const existing = await client.query("SELECT id,name,slug,status FROM recruiter_workspaces WHERE owner_user_id=$1 AND status='active' ORDER BY created_at LIMIT 1", [session.user.id]);
      if (existing.rowCount) workspace = existing.rows[0];
      else {
        const id = randomUUID();
        const base = workspaceName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) || "company";
        const slug = base + "-" + id.slice(0, 8);
        const created = await client.query("INSERT INTO recruiter_workspaces(id,name,slug,owner_user_id,status) VALUES($1,$2,$3,$4,'active') RETURNING id,name,slug,status", [id, workspaceName, slug, session.user.id]);
        workspace = created.rows[0];
        await client.query("INSERT INTO recruiter_workspace_members(workspace_id,user_id,role,status,joined_at) VALUES($1,$2,'owner','active',NOW()) ON CONFLICT(workspace_id,user_id) DO NOTHING", [id, session.user.id]);
        await client.query("INSERT INTO recruiter_credit_accounts(workspace_id) VALUES($1) ON CONFLICT(workspace_id) DO NOTHING", [id]);
      }
    }
    await client.query("COMMIT");
    return NextResponse.json({ success: true, accountType, workspace }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const e = error as { message?: string; status?: number };
    return NextResponse.json({ error: e.message || "Unable to save account type." }, { status: e.status || 500 });
  } finally { client.release(); }
}