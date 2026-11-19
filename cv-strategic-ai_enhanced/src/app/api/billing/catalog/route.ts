import { NextResponse } from "next/server";
import { PLAN_CATALOG,PLAN_QUOTAS } from "@/lib/billing/catalog";
export const dynamic="force-static";
export async function GET(){return NextResponse.json({plans:PLAN_CATALOG,quotas:PLAN_QUOTAS,currencies:["USD","EUR","TND"],intervals:["monthly","annual"]},{headers:{"Cache-Control":"public,max-age=300"}});}
