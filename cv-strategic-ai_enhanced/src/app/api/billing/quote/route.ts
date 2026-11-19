import { NextRequest,NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server-session";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { checkoutRequestSchema } from "@/lib/billing/model";
import { BillingService } from "@/lib/billing/service";
export const runtime="nodejs";export const dynamic="force-dynamic";
const service=new BillingService();
export async function POST(request:NextRequest){const session=await getCurrentSession();if(!session?.user?.id)return NextResponse.json({error:"Authentication required."},{status:401});let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid JSON."},{status:400});}const parsed=checkoutRequestSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Invalid plan, interval or currency.",details:parsed.error.flatten()},{status:400});try{await ensureAuthSchema();const quote=await service.quote(session.user.id,parsed.data);return NextResponse.json({...quote,checkoutAvailable:false,message:"The quote is calculated from the server-owned catalogue, but checkout remains unavailable until the selected payment provider completes merchant onboarding and webhook integration."},{status:201,headers:{"Cache-Control":"no-store"}});}catch(error){const e=error as {message?:string;status?:number};return NextResponse.json({error:e.message||"Unable to prepare subscription quote."},{status:e.status||500});}}
