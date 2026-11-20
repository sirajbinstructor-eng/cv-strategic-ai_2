import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-session";
import { requireRecruiterAccess } from "@/lib/recruiter/access";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const access = await requireRecruiterAccess(user.id);
    const [jobs, candidates, batches] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='open')::int AS open FROM recruiter_job_descriptions WHERE workspace_id=$1",[access.workspaceId]),
      pool.query("SELECT COUNT(*)::int AS total FROM recruiter_candidates WHERE workspace_id=$1 AND deleted_at IS NULL",[access.workspaceId]),
      pool.query("SELECT COUNT(*)::int AS total,COUNT(*) FILTER(WHERE status='completed')::int AS completed FROM recruiter_evaluation_batches WHERE workspace_id=$1",[access.workspaceId])
    ]);
    return NextResponse.json({
      workspace:{id:access.workspaceId,name:access.workspaceName,slug:access.workspaceSlug,role:access.role},
      permissions:{canManage:access.canManage,isAdmin:access.isAdmin,unrestricted:access.unrestricted,premiumBatchMatchingEnabled:access.premiumBatchMatchingEnabled},
      credits:{included:access.includedCredits,purchased:access.purchasedCredits,reserved:access.reservedCredits,available:access.includedCredits+access.purchasedCredits},
      subscription:access.subscription,
      metrics:{jobs:jobs.rows[0],candidates:candidates.rows[0],batches:batches.rows[0]}
    },{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    const e=error as {message?:string;status?:number};
    return NextResponse.json({error:e.message||"Unable to load recruiter workspace."},{status:e.status||500});
  }
}
