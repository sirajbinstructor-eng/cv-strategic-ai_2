import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/server-session";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { BillingService } from "@/lib/billing/service";
import { getBillingEntitlements } from "@/lib/billing/entitlements";
export const runtime="nodejs";export const dynamic="force-dynamic";
const service=new BillingService();
export async function GET(){const session=await getCurrentSession();if(!session?.user?.id)return NextResponse.json({error:"Authentication required."},{status:401});try{await ensureAuthSchema();const [subscription,entitlements]=await Promise.all([service.current(session.user.id),getBillingEntitlements(session.user.id)]);return NextResponse.json({subscription,entitlements},{headers:{"Cache-Control":"no-store"}});}catch(error){console.error("[billing]",error);return NextResponse.json({error:"Unable to load subscription."},{status:500});}}
