import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentSession } from "@/lib/server-session";
import { pool } from "@/lib/db";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  await ensureAuthSchema();
  const parsedBody = await request.json().catch(() => ({}));
  const body = parsedBody && typeof parsedBody === "object" ? parsedBody as Record<string, unknown> : {};
  const accountType = body.accountType;
  const workspaceName = typeof body.workspaceName === "string" ? body.workspaceName.trim() : "";

  if (accountType !== "job_seeker" && accountType !== "recruiter") {
    return NextResponse.json({ error: "Choose Job Seeker or HR / Recruiter / Company." }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(
      'SELECT account_type,is_admin FROM "user" WHERE id=$1 FOR UPDATE',
      [session.user.id]
    );
    if (!current.rowCount) {
      throw Object.assign(new Error("Account not found."), { status: 404 });
    }

    const isAdmin = current.rows[0].is_admin === true;
    const existingType = current.rows[0].account_type as string | null;
    if (existingType && existingType !== accountType && !isAdmin) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Your account type has already been selected. Contact an administrator if it needs to be changed." },
        { status: 409 }
      );
    }

    let workspace = null;
    if (accountType === "recruiter") {
      const existing = await client.query(
        "SELECT w.id,w.name,w.slug,w.status FROM recruiter_workspaces w JOIN recruiter_workspace_members m ON m.workspace_id=w.id WHERE m.user_id=$1 AND m.status='active' AND w.status='active' ORDER BY w.created_at LIMIT 1",
        [session.user.id]
      );

      if (existing.rowCount) {
        workspace = existing.rows[0];
      } else {
        const resolvedWorkspaceName = isAdmin && workspaceName.length === 0
          ? "CV Strategist AI Admin Test Workspace"
          : workspaceName;
        if (resolvedWorkspaceName.length < 2 || resolvedWorkspaceName.length > 120) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "Enter a company or agency name (2–120 characters)." },
            { status: 400 }
          );
        }

        const id = randomUUID();
        const base = resolvedWorkspaceName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) || "company";
        const slug = base + "-" + id.slice(0, 8);
        const created = await client.query(
          "INSERT INTO recruiter_workspaces(id,name,slug,owner_user_id,status) VALUES($1,$2,$3,$4,'active') RETURNING id,name,slug,status",
          [id, resolvedWorkspaceName, slug, session.user.id]
        );
        workspace = created.rows[0];
        await client.query(
          "INSERT INTO recruiter_workspace_members(workspace_id,user_id,role,status,joined_at) VALUES($1,$2,'owner','active',NOW()) ON CONFLICT(workspace_id,user_id) DO NOTHING",
          [id, session.user.id]
        );
        await client.query(
          "INSERT INTO recruiter_credit_accounts(workspace_id) VALUES($1) ON CONFLICT(workspace_id) DO NOTHING",
          [id]
        );
      }
    }

    await client.query(
      'UPDATE "user" SET account_type=$2,updated_at=NOW() WHERE id=$1',
      [session.user.id, accountType]
    );
    await client.query("COMMIT");

    return NextResponse.json(
      { success: true, accountType, workspace, adminWorkspaceSwitch: isAdmin },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const e = error as { message?: string; status?: number };
    return NextResponse.json(
      { error: e.message || "Unable to save account type." },
      { status: e.status || 500 }
    );
  } finally {
    client.release();
  }
}
