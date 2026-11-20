import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server-session";
import { requireRecruiterAccess } from "@/lib/recruiter/access";
import { pool } from "@/lib/db";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function DELETE(_request:NextRequest,context:Context){
 try{const user=await requireUser();const access=await requireRecruiterAccess(user.id,true);const {id}=await context.params;
  const r=await pool.query(`UPDATE recruiter_candidates SET deleted_at=NOW(),encrypted_cv_text='',encryption_iv='',encryption_tag=''
   WHERE id=$1 AND workspace_id=$2 AND deleted_at IS NULL RETURNING id`,[id,access.workspaceId]);
  if(!r.rowCount)return NextResponse.json({error:"CV not found."},{status:404});
  return NextResponse.json({success:true});
 }catch(error){const e=error as {message?:string;status?:number};return NextResponse.json({error:e.message||"Unable to delete CV."},{status:e.status||500});}
}
