import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server-session";
import { getDocumentUploadGate,ACCEPTED_VERIFICATION_DOCUMENTS,DOCUMENT_UPLOAD_LIMITS } from "@/lib/verification/document-upload-gate";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(){const session=await getCurrentSession();if(!session?.user?.id)return NextResponse.json({error:"Authentication required."},{status:401});const gate=getDocumentUploadGate();return NextResponse.json({uploadsEnabled:gate.enabled,reason:gate.reason,requiredEvidence:ACCEPTED_VERIFICATION_DOCUMENTS,limits:{maxBytes:DOCUMENT_UPLOAD_LIMITS.maxBytes,allowedMimeTypes:DOCUMENT_UPLOAD_LIMITS.allowedMimeTypes},storageMode:"private object storage only"},{headers:{"Cache-Control":"no-store"}});}
