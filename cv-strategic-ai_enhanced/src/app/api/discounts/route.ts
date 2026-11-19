import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server-session";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { applyDiscountSchema } from "@/lib/discounts/model";
import { DiscountService } from "@/lib/discounts/service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const service=new DiscountService();
export async function GET(){const session=await getCurrentSession();if(!session?.user?.id)return NextResponse.json({error:"Authentication required."},{status:401});try{await ensureAuthSchema();const application=await service.current(session.user.id);return NextResponse.json({application},{headers:{"Cache-Control":"no-store"}});}catch(error){console.error("[discounts]",error);return NextResponse.json({error:"Unable to load discount application."},{status:500});}}
export async function POST(request:NextRequest){const session=await getCurrentSession();if(!session?.user?.id)return NextResponse.json({error:"Authentication required."},{status:401});let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid JSON body."},{status:400});}const parsed=applyDiscountSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Invalid discount application.",details:parsed.error.flatten()},{status:400});try{await ensureAuthSchema();const application=await service.apply(session.user.id,parsed.data);return NextResponse.json({application,message:"Your discount application has been submitted for manual review."},{status:201,headers:{"Cache-Control":"no-store"}});}catch(error){const e=error as {message?:string;status?:number};if((e.status||500)===500)console.error("[discounts]",error);return NextResponse.json({error:e.status?e.message:"Unable to submit discount application."},{status:e.status||500,headers:{"Cache-Control":"no-store"}});}}
