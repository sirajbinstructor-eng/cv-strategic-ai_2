import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/server-session";
import { requireRecruiterAccess } from "@/lib/recruiter/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const jobSchema=z.object({title:z.string().trim().min(2).max(160),department:z.string().trim().max(120).optional().default(""),location:z.string().trim().max(160).optional().default(""),employmentType:z.string().trim().max(80).optional().default(""),description:z.string().trim().min(80).max(30000),status:z.enum(["draft","open","closed"]).optional().default("open")});

export async function GET(){
 try{const user=await requireUser();const access=await requireRecruiterAccess(user.id);const {pool}=await import("@/lib/db");
  const r=await pool.query("SELECT id,title,department,location,employment_type,status,description,length(description)::int AS description_length,created_at,updated_at FROM recruiter_job_descriptions WHERE workspace_id=$1 ORDER BY created_at DESC",[access.workspaceId]);
  return NextResponse.json({jobs:r.rows},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const e=error as {message?:string;status?:number};return NextResponse.json({error:e.message||"Unable to load jobs."},{status:e.status||500});}
}

export async function POST(request:NextRequest){
 try{const user=await requireUser();const access=await requireRecruiterAccess(user.id,true);const parsed=jobSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message||"Invalid job description."},{status:400});
  const {pool}=await import("@/lib/db");const id=randomUUID();const v=parsed.data;
  const r=await pool.query(`INSERT INTO recruiter_job_descriptions(id,workspace_id,title,department,location,employment_type,description,status,created_by)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,title,department,location,employment_type,status,created_at,updated_at`,
   [id,access.workspaceId,v.title,v.department||null,v.location||null,v.employmentType||null,v.description,v.status,user.id]);
  return NextResponse.json({job:r.rows[0]},{status:201});
 }catch(error){const e=error as {message?:string;status?:number};return NextResponse.json({error:e.message||"Unable to create job."},{status:e.status||500});}
}
