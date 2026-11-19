import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server-session";
import { getDocumentUploadGate } from "@/lib/verification/document-upload-gate";
export const runtime="nodejs";export const dynamic="force-dynamic";
/** Deliberately does not parse or persist request bodies until secure storage is production-ready. */
export async function POST(){const session=await getCurrentSession();if(!session?.user?.id)return NextResponse.json({error:"Authentication required."},{status:401});const gate=getDocumentUploadGate();return NextResponse.json({error:gate.reason||"The secure document upload adapter is not enabled. No file was accepted or stored."},{status:503,headers:{"Cache-Control":"no-store"}});}
