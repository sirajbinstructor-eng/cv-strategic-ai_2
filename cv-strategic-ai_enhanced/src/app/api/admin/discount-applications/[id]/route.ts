import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, apiError } from "@/lib/admin/controller";
import { ensureAuthSchema } from "@/lib/db/ensure-auth-schema";
import { reviewDiscountSchema } from "@/lib/discounts/model";
import { DiscountService } from "@/lib/discounts/service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const service=new DiscountService();
type Context={params:Promise<{id:string}>};
export async function PATCH(request:NextRequest,context:Context){const access=await requireAdmin();if(access.error)return access.error;let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid JSON body."},{status:400});}const parsed=reviewDiscountSchema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Invalid review decision.",details:parsed.error.flatten()},{status:400});try{await ensureAuthSchema();const application=await service.review((await context.params).id,access.user.id,parsed.data);return NextResponse.json({application},{headers:{"Cache-Control":"no-store"}});}catch(error){return apiError(error);}}
