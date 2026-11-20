import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server-session";
import { requireRecruiterAccess } from "@/lib/recruiter/access";
import { pool } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const patchSchema=z.object({title:z.string().trim().min(2).max(160).optional(),department:z.string().trim().max(120).optional(),location:z.string().trim().max(160).optional(),employmentType:z.string().trim().max(80).optional(),description:z.string().trim().min(80).max(30000).optional(),status:z.enum(["draft","open","closed","archived"]).optional()}).refine(v=>Object.keys(v).length>0);
type Context={params:Promise<{id:string}>};

export async function PATCH(request:NextRequest,context:Context){
 try{const user=await requireUser();const access=await requireRecruiterAccess(user.id,true);const {id}=await context.params;const parsed=patchSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:"Invalid job update."},{status:400});
  const fields=parsed.data;const map:Record<string,string>={title:"title",department:"department",location:"location",employmentType:"employment_type",description:"description",status:"status"};
  const keys=Object.keys(fields) as Array<keyof typeof fields>;const values:unknown[]=[id,access.workspaceId];const sets=keys.map(k=>{values.push(fields[k]);return map[k]+"=$"+values.length;});
  const r=await pool.query(`UPDATE recruiter_job_descriptions SET ${sets.join(",")},updated_at=NOW() WHERE id=$1 AND workspace_id=$2 RETURNING id,title,department,location,employment_type,status,created_at,updated_at`,values);
  if(!r.rowCount)return NextResponse.json({error:"Job description not found."},{status:404});
  return NextResponse.json({job:r.rows[0]});
 }catch(error){const e=error as {message?:string;status?:number};return NextResponse.json({error:e.message||"Unable to update job."},{status:e.status||500});}
}

export async function DELETE(_request:NextRequest,context:Context){
 try{const user=await requireUser();const access=await requireRecruiterAccess(user.id,true);const {id}=await context.params;
  const r=await pool.query("UPDATE recruiter_job_descriptions SET status='archived',updated_at=NOW() WHERE id=$1 AND workspace_id=$2 RETURNING id",[id,access.workspaceId]);
  if(!r.rowCount)return NextResponse.json({error:"Job description not found."},{status:404});
  return NextResponse.json({success:true});
 }catch(error){const e=error as {message?:string;status?:number};return NextResponse.json({error:e.message||"Unable to archive job."},{status:e.status||500});}
}
