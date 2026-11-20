import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/server-session";
import { requireRecruiterAccess } from "@/lib/recruiter/access";
import { decryptSensitiveText, encryptCvText, encryptSensitiveText } from "@/lib/recruiter/cv-vault";
import { extractCvText } from "@/lib/documents/extract";
import { pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const DOCX="application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(){
 try{const user=await requireUser();const access=await requireRecruiterAccess(user.id);
  const r=await pool.query("SELECT id,original_filename,content_type,text_length,created_at,retention_expires_at FROM recruiter_candidates WHERE workspace_id=$1 AND deleted_at IS NULL AND retention_expires_at>NOW() ORDER BY created_at DESC",[access.workspaceId]);
  return NextResponse.json({candidates:r.rows.map(row=>({...row,original_filename:decryptSensitiveText(row.original_filename)}))},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const e=error as {message?:string;status?:number};return NextResponse.json({error:e.message||"Unable to load candidate CVs."},{status:e.status||500});}
}

export async function POST(request:NextRequest){
 try{
  const user=await requireUser();const access=await requireRecruiterAccess(user.id,true);
  const form=await request.formData();
  if(form.get("authorizationConfirmed")!=="true")return NextResponse.json({error:"Confirm that your organization is authorized to process these CVs before uploading."},{status:400});
  const files=form.getAll("files").filter((v):v is File=>v instanceof File);
  if(!files.length)return NextResponse.json({error:"Choose at least one CV file."},{status:400});
  if(files.length>10)return NextResponse.json({error:"Upload no more than 10 CVs in one batch."},{status:400});
  // Validate the encryption configuration before reading or accepting candidate data.
  encryptCvText("storage-key-check");
  const uploaded=[];
  for(const file of files){
   const extension=file.name.split(".").pop()?.toLowerCase();
   if(extension!=="pdf"&&extension!=="docx")return NextResponse.json({error:`${file.name}: only PDF and DOCX files are supported.`},{status:415});
   const cvText=await extractCvText(file);
   const encrypted=encryptCvText(cvText);
   const id=randomUUID();
   const contentType=extension==="pdf"?"application/pdf":DOCX;
   const safeName=file.name.replaceAll("/","_").replaceAll("\\\\","_").replace(/[\u0000-\u001f]/g,"_").slice(0,180);
   const storedFilename=encryptSensitiveText(safeName);
   const r=await pool.query(`INSERT INTO recruiter_candidates(id,workspace_id,original_filename,content_type,encrypted_cv_text,encryption_iv,encryption_tag,text_length,uploaded_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,original_filename,content_type,text_length,created_at,retention_expires_at`,
    [id,access.workspaceId,storedFilename,contentType,encrypted.ciphertext,encrypted.iv,encrypted.tag,cvText.length,user.id]);
   uploaded.push({...r.rows[0],original_filename:safeName});
  }
  return NextResponse.json({uploaded},{status:201,headers:{"Cache-Control":"no-store"}});
 }catch(error){const e=error as {message?:string;status?:number};return NextResponse.json({error:e.message||"Unable to upload CVs."},{status:e.status||500});}
}
