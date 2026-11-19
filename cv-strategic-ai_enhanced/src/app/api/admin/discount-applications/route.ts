import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, apiError } from "@/lib/admin/controller";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { statusSchema } from "@/lib/discounts/model";
import { DiscountService } from "@/lib/discounts/service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const service=new DiscountService();
export async function GET(request:NextRequest){const access=await requireAdmin();if(access.error)return access.error;const rawStatus=request.nextUrl.searchParams.get("status")||undefined;if(rawStatus&&!statusSchema.safeParse(rawStatus).success)return NextResponse.json({error:"Invalid status."},{status:400});const limit=Math.min(100,Math.max(1,Number(request.nextUrl.searchParams.get("limit")||50)));const offset=Math.max(0,Number(request.nextUrl.searchParams.get("offset")||0));try{await ensureAuthSchema();return NextResponse.json(await service.list(rawStatus,limit,offset),{headers:{"Cache-Control":"no-store"}});}catch(error){return apiError(error);}}
