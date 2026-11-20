import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/server-session";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { ensureRecruiterDataSchema } from "@/lib/db/ensure-recruiter-data-schema";
import { pool } from "@/lib/db";

export const runtime="nodejs";
const grantSchema=z.object({
 amount:z.number().int().min(1).max(100000),
 bucket:z.enum(["included","purchased"]).default("included"),
 reason:z.string().trim().min(5).max(300),
 idempotencyKey:z.string().min(8).max(120).optional()
});
type Context={params:Promise<{id:string}>};

export async function POST(request:NextRequest,context:Context){
 try{
  const user=await requireUser();await ensureAuthSchema();await ensureRecruiterDataSchema();
  const admin=await pool.query('SELECT is_admin FROM "user" WHERE id=$1',[user.id]);
  if(admin.rows[0]?.is_admin!==true)return NextResponse.json({error:"Administrator access required."},{status:403});
  const {id:workspaceId}=await context.params;
  const parsed=grantSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"Invalid credit adjustment."},{status:400});
  const value=parsed.data, idempotency=value.idempotencyKey||randomUUID();
  const client=await pool.connect();
  try{
   await client.query("BEGIN");
   const duplicate=await client.query("SELECT id,amount,credit_bucket FROM recruiter_credit_ledger WHERE idempotency_key=$1",[idempotency]);
   if(duplicate.rowCount){await client.query("ROLLBACK");return NextResponse.json({error:"This credit adjustment was already applied.",adjustment:duplicate.rows[0]},{status:409});}
   const workspace=await client.query("SELECT id FROM recruiter_workspaces WHERE id=$1 AND status='active' FOR UPDATE",[workspaceId]);
   if(!workspace.rowCount){await client.query("ROLLBACK");return NextResponse.json({error:"Recruiter workspace not found."},{status:404});}
   await client.query("INSERT INTO recruiter_credit_accounts(workspace_id) VALUES($1) ON CONFLICT(workspace_id) DO NOTHING",[workspaceId]);
   const column=value.bucket==="included"?"included_available":"purchased_available";
   const updated=await client.query(`UPDATE recruiter_credit_accounts SET ${column}=${column}+$2,updated_at=NOW() WHERE workspace_id=$1 RETURNING included_available,purchased_available,reserved`,[workspaceId,value.amount]);
   const ledger=await client.query(`INSERT INTO recruiter_credit_ledger(id,workspace_id,credit_bucket,entry_type,amount,idempotency_key,metadata)
    VALUES($1,$2,$3,'admin_adjustment',$4,$5,$6) RETURNING id,created_at`,
    [randomUUID(),workspaceId,value.bucket,value.amount,idempotency,JSON.stringify({reason:value.reason,adminUserId:user.id})]);
   await client.query("COMMIT");
   return NextResponse.json({success:true,workspaceId,balance:updated.rows[0],adjustment:ledger.rows[0]},{status:201});
  }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
 }catch(error){const e=error as {message?:string;status?:number};return NextResponse.json({error:e.message||"Unable to adjust recruiter credits."},{status:e.status||500});}
}
